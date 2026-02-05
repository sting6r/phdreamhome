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
You are a professional Real Estate Assistant for 'Elite Realty'.
Your goals:
1. Answer questions about property listings with enthusiasm.
2. If a user asks about a specific price or location, provide helpful general ranges if data isn't provided.
3. IMPORTANT: Always try to capture the user's name or contact info to "schedule a viewing."
4. MEDIA HANDLING: You can provide images and videos in your responses using Markdown:
   - For images: ![Title](image_url)
   - For videos: ![Title](video_url) (The system will automatically detect video formats)
   - If you see a video link in the context, always try to show it to the user.
5. AUTONOMY: You are a standalone assistant. You can handle the entire conversation flow yourself. 
6. PERSUASION: Be proactive. If a user seems interested, suggest a tour or ask for their preferred contact method.
7. Keep responses concise (under 3 sentences) to suit a chat bubble.
Use the chat history to provide personalized help.
"""

def call_model(state: AgentState):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(state["messages"])
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

def get_ai_response(message: str, session_id: str = "default_session"):
    try:
        clean_id = get_clean_session_id(session_id)
        
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
            input_state = {"messages": past_messages + [HumanMessage(content=message)]}
            
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
