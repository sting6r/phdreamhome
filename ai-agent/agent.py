import os
import uuid
import psycopg
import json
from psycopg_pool import ConnectionPool
from langchain_groq import ChatGroq
from langchain_postgres import PostgresChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated, List, Sequence
from langchain_core.messages import BaseMessage
from dotenv import load_dotenv

# 1. Configuration
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY.replace('"', '')

DB_URL = os.getenv("DATABASE_URL", "").replace('"', '')
if "6543" in DB_URL:
    DB_URL = DB_URL.replace(":6543", ":5432").split("?")[0]

# 2. Initialize Pool and Model
pool = ConnectionPool(DB_URL, min_size=1, max_size=10)
default_model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2)
vision_model = ChatGroq(model="llama-3.2-11b-vision-preview", temperature=0.2)

# Initialize the table at startup
def init_db():
    try:
        with pool.connection() as conn:
            PostgresChatMessageHistory.create_tables(conn, "chat_history")
            print("Database table 'chat_history' initialized.")
    except Exception as e:
        print(f"Error initializing database: {e}")

init_db()

# Tool: Fetch media for a specific listing
def get_listing_media(listing_id: str):
    """Fetches all images and videos for a specific listing from the database."""
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Fetch images
                cur.execute(
                    'SELECT url, "sortOrder" FROM "ListingImage" WHERE "listingId" = %s ORDER BY "sortOrder" ASC',
                    (listing_id,)
                )
                images = cur.fetchall()
                
                # Fetch videos (if table exists and matches this schema)
                # For now, we assume images are the primary media
                media_list = []
                for img in images:
                    media_list.append({"url": img[0], "type": "image"})
                
                return media_list
    except Exception as e:
        print(f"Error fetching media: {e}")
        return []

# Tool: Find listing by title or slug
def find_listing(query: str):
    """Finds a listing by title or slug to get its ID."""
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT id, title, slug FROM "Listing" WHERE title ILIKE %s OR slug ILIKE %s LIMIT 1',
                    (f"%{query}%", f"%{query}%")
                )
                res = cur.fetchone()
                if res:
                    return {"id": res[0], "title": res[1], "slug": res[2]}
                return None
    except Exception as e:
        print(f"Error finding listing: {e}")
        return None

# 3. Define State and Graph
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], lambda x, y: x + y]

SYSTEM_PROMPT = """
You are a professional Real Estate Assistant for 'PhDreamHome'.
Your goals:
1. Answer questions about property listings with enthusiasm.
2. STRICT INVENTORY POLICY: Only offer properties that are explicitly provided in the chat context or listing data. 
   - DO NOT invent, hallucinate, or assume any property details.
   - DO NOT provide links to external websites or example.com.
   - If a user asks for a property that you don't see in the provided context, politely inform them that you couldn't find it in our current inventory and offer to help them find something else from our available listings.
   - EVERY property recommendation MUST be based on data provided in the current 'Additional Context from the website'.
3. CURRENCY & LOCATION: Use the appropriate currency based on the property's location:
   - For Philippines: Use Philippine Peso (₱ or PHP).
   - For USA: Use US Dollars ($ or USD).
   - For UAE/Dubai: Use UAE Dirham (AED).
   - For Singapore: Use Singapore Dollars (S$ or SGD).
   Always format prices clearly (e.g., ₱15,000,000 or $500,000).
4. NO HALLUCINATIONS: If a user asks for a property, location, or price range that is NOT in the provided context, you MUST state that you don't have that specific inventory currently. DO NOT provide "general ranges" or "typical prices" for locations not in our database.
5. MEDIA HANDLING: You must provide images and videos in your responses using Markdown to support the client's needs:
   - For images: ![Title](image_url)
   - For videos: ![Title](video_url)
   - Always include at least one relevant image for each property you recommend.
   - If the user asks for "more pictures" or "videos" of a specific listing, you should refer to the additional media context if available.
6. AUTONOMY: You are a standalone assistant. You can handle the entire conversation flow yourself. 
7. PERSUASION: Be proactive. If a user seems interested, suggest a tour or provide a link to view the full listing.
8. Keep responses concise (under 3 sentences) to suit a chat bubble.
9. INTERACTIVE CHOICES: If you provide options, choices, or suggestions to the user, format them using [CHOICES] Option 1 | Option 2 [/CHOICES] at the end of your message. This will render as clickable buttons for the user.
   - Use "Send Message", "Call Agent", or "Email Agent" when the user wants to contact someone.
   - Use "View Listings" when the user wants to see more properties.
   - Example: "Would you like to speak with an agent? [CHOICES] Send Message | Call Agent | Email Agent [/CHOICES]"
11. AGENT CONTACT CARD: If the user wants to contact an agent, see agent details, or speak with someone, you can display an interactive agent card using [AGENT_CARD] block.
    - Format: 
      [AGENT_CARD]
      Name: Del Adones Adlawan
      Role: REAL ESTATE AGENT
      PRC: 13123123
      DHSUD: HS-1231
      Phone: 09772838819
      Email: deladonesadlawan@gmail.com
      Listings: 5
              [/AGENT_CARD]
    - Use [PHONE_DISPLAY]09772838819[/PHONE_DISPLAY] if the user ONLY wants the contact number.
    - Use [EMAIL_DISPLAY]deladonesadlawan@gmail.com[/EMAIL_DISPLAY] if the user ONLY wants the email address.
    - Always offer this when user asks for "Call Agent", "Email Agent", or "Contact Us".
12. TOUR SCHEDULE FORM: If the user wants to "Schedule a Tour", "Book a Visit", or "See the property in person", you can display an interactive tour form using [TOUR_FORM] block.
    - Format:
      [TOUR_FORM]
      Property: [Property Name]
      [/TOUR_FORM]
    - Always offer this when user asks for a visit or tour.
13. ONLY REAL DATA: Every property you mention MUST have a link and an image from the provided context. If it doesn't have a link, it's not in our database—DO NOT MENTION IT. If you are unsure if a property is in the context, assume it is NOT.
Use the chat history and the provided listing context to provide personalized help.
"""

def call_model(state: AgentState):
    # Check if there's already a system message
    has_system = any(isinstance(m, SystemMessage) for m in state["messages"])
    messages = list(state["messages"])
    if not has_system:
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    
    # Check if any message contains an image
    has_image = False
    for msg in messages:
        if isinstance(msg.content, list):
            for part in msg.content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    has_image = True
                    break
        elif isinstance(msg.content, str):
            # Check for Markdown image OR if it's a JSON string with image_url
            if "![" in msg.content and "](" in msg.content:
                has_image = True
            elif '{"type": "image_url"' in msg.content or "'type': 'image_url'" in msg.content:
                has_image = True
        
        if has_image:
            break

    model_to_use = vision_model if has_image else default_model
    print(f"Using model: {'vision' if has_image else 'default'}")
    
    response = model_to_use.invoke(messages)
    return {"messages": [response]}

# Define the graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_edge(START, "agent")
workflow.add_edge("agent", END)

# Use MemorySaver for transient session state (LangGraph requirement)
memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

def get_clean_session_id(session_id: str):
    try:
        val = uuid.UUID(str(session_id))
        return str(val)
    except (ValueError, TypeError):
        NAMESPACE_UUID = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
        return str(uuid.uuid5(NAMESPACE_UUID, str(session_id)))

import json

def get_ai_response(message: str, session_id: str = "default_session", user_data: dict = None, additional_context: str = None):
    try:
        clean_id = get_clean_session_id(session_id)
        
        # Check if message is a JSON string (could contain structured parts with images)
        try:
            parsed_message = json.loads(message)
            if isinstance(parsed_message, (list, dict)):
                message_content = parsed_message
            else:
                message_content = message
        except (json.JSONDecodeError, TypeError):
            message_content = message

        # Prepare dynamic system prompt components
        user_info = ""
        if user_data:
            user_info = f"\nUser Information (Already captured):\n" \
                        f"- Name: {user_data.get('name', 'Not provided')}\n" \
                        f"- Email: {user_data.get('email', 'Not provided')}\n" \
                        f"- Phone: {user_data.get('phone', 'Not provided')}\n" \
                        f"DO NOT ask for these details again as they have already been provided.\n"
        
        context_info = ""
        if additional_context:
            context_info = f"\nAdditional Context from the website:\n{additional_context}\n"
            
            # Auto-fetch media if user asks for pictures/videos of a specific property mentioned in context
            media_context = ""
            if any(word in message.lower() for word in ["picture", "image", "photo", "video", "show me more"]):
                # Try to extract property title from context or message
                # This is a heuristic: look for property IDs or names in the context
                try:
                    import re
                    # Look for IDs like "cmij..." or similar common patterns in this DB
                    listing_ids = re.findall(r'[a-z0-9]{25}', additional_context)
                    for lid in set(listing_ids):
                        media = get_listing_media(lid)
                        if media:
                            media_context += f"\nAdditional Media for Listing {lid}:\n"
                            for m in media:
                                # We need to sign these URLs if they are just paths
                                # For now, we'll provide the raw paths/URLs and let the frontend or a signing helper handle it
                                # If the path starts with images: or videos: it needs signing
                                media_context += f"- {m['type']}: {m['url']}\n"
                except Exception as media_err:
                    print(f"Error auto-fetching media context: {media_err}")
            
            if media_context:
                context_info += media_context

        # Check if we have an image in the current message
        has_image = False
        if isinstance(message_content, list):
            for part in message_content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    has_image = True
                    break
        elif isinstance(message_content, str):
            if "![" in message_content and "](" in message_content:
                has_image = True
            elif '{"type": "image_url"' in message_content or "'type': 'image_url'" in message_content:
                has_image = True

        if has_image:
            # Special instruction for vision model
            vision_instruction = "\nIMAGE ANALYSIS: The user has provided an image. Please analyze it carefully to assist with their property sale or inquiry.\n"
            dynamic_system_prompt = SYSTEM_PROMPT + user_info + context_info + vision_instruction
        else:
            dynamic_system_prompt = SYSTEM_PROMPT + user_info + context_info
        
        # Get a connection from the pool
        with pool.connection() as conn:
            # Initialize Postgres history for persistence
            history = PostgresChatMessageHistory(
                "chat_history",
                clean_id,
                sync_connection=conn
            )
            
            # Load existing messages from Postgres
            past_messages = history.messages
            
            # Prepare LangGraph config
            config = {"configurable": {"thread_id": clean_id}}
            
            # We'll include past messages in the state to ensure the model has context
            # Use the dynamic prompt for this call
            messages = [SystemMessage(content=dynamic_system_prompt)] + past_messages + [HumanMessage(content=message_content)]
            input_state = {"messages": messages}
            
            # Run the workflow
            final_state = app.invoke(input_state, config=config)
            
            # Extract the last message from the model
            response_message = final_state["messages"][-1]
            response_text = response_message.content
            
            # Save ONLY the new messages to Postgres
            history.add_user_message(str(message_content))
            history.add_ai_message(response_text)
            
            return response_text
    except Exception as e:
        print(f"Error in get_ai_response: {e}")
        return f"I'm sorry, I encountered an error: {str(e)}"

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(get_ai_response(sys.argv[1]))
    else:
        print(get_ai_response("Hello, who are you?"))
