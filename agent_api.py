from fastapi import FastAPI, HTTPException 
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel 
from typing import List, Optional 
import uvicorn 
import os
from dotenv import load_dotenv

# Import the logic from the previous script 
from agent import get_ai_response

load_dotenv()

app = FastAPI(title="Real Estate AI API") 

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# Define the request structure 
class ChatRequest(BaseModel): 
    message: str 
    session_id: Optional[str] = "default_session" # Make it optional with a default
    history: Optional[List[dict]] = [] 

@app.post("/chat") 
def chat_endpoint(request: ChatRequest): 
    try: 
        # Ensure we have a valid session_id
        session_id = request.session_id or "default_session"
        
        # get_ai_response is a synchronous function that performs DB and LLM I/O.
        # By defining this endpoint with 'def' instead of 'async def', FastAPI
        # will run it in a separate threadpool, preventing the event loop from blocking.
        response_text = get_ai_response(request.message, session_id=session_id) 
        
        return { 
            "status": "success", 
            "response": response_text, 
            "agent": "EliteRealty-Bot" 
        } 
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e)) 

if __name__ == "__main__": 
    # Run the server on all interfaces at port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
