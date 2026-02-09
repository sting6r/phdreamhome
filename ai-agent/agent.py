import os
import uuid
import psycopg
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
model = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2)

# Initialize the table at startup
def init_db():
    try:
        with pool.connection() as conn:
            PostgresChatMessageHistory.create_tables(conn, "chat_history")
            print("Database table 'chat_history' initialized.")
    except Exception as e:
        print(f"Error initializing database: {e}")

init_db()

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
6. AUTONOMY: You are a standalone assistant. You can handle the entire conversation flow yourself. 
7. PERSUASION: Be proactive. If a user seems interested, suggest a tour or provide a link to view the full listing.
8. Keep responses concise (under 3 sentences) to suit a chat bubble.
9. ONLY REAL DATA: Every property you mention MUST have a link and an image from the provided context. If it doesn't have a link, it's not in our database—DO NOT MENTION IT. If you are unsure if a property is in the context, assume it is NOT.
Use the chat history and the provided listing context to provide personalized help.
"""

def call_model(state: AgentState):
    # Check if there's already a system message
    has_system = any(isinstance(m, SystemMessage) for m in state["messages"])
    messages = list(state["messages"])
    if not has_system:
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
        
    response = model.invoke(messages)
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

def get_ai_response(message: str, session_id: str = "default_session", user_data: dict = None, additional_context: str = None):
    try:
        clean_id = get_clean_session_id(session_id)
        
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
            messages = [SystemMessage(content=dynamic_system_prompt)] + past_messages + [HumanMessage(content=message)]
            input_state = {"messages": messages}
            
            # Run the workflow
            final_state = app.invoke(input_state, config=config)
            
            # Extract the last message from the model
            response_message = final_state["messages"][-1]
            response_text = response_message.content
            
            # Save ONLY the new messages to Postgres
            history.add_user_message(message)
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
