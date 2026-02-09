from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
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
    user_data: Optional[dict] = None
    additional_context: Optional[str] = None

@app.get("/", response_class=HTMLResponse)
def root():
    return """
    <html>
        <head>
            <title>Elite Realty AI Agent</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
                .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
                h1 { color: #1a73e8; }
                p { color: #5f6368; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Elite Realty AI Agent</h1>
                <p>The AI Agent is online and ready to assist.</p>
                <p>API Status: <span style="color: green;">Active</span></p>
            </div>
        </body>
    </html>
    """

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai-agent"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    # Try to serve from public if it exists, otherwise return a 204 or small placeholder
    favicon_path = "public/favicon.ico"
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return JSONResponse(status_code=204, content={})

@app.get("/robots.txt", include_in_schema=False)
async def robots():
    robots_path = "public/robots.txt"
    if os.path.exists(robots_path):
        return FileResponse(robots_path)
    return HTMLResponse(content="User-agent: *\nAllow: /", media_type="text/plain")

@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    sitemap_path = "public/sitemap.xml"
    if os.path.exists(sitemap_path):
        return FileResponse(sitemap_path, media_type="application/xml")
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

@app.get("/get_server_info", include_in_schema=False)
async def server_info():
    return {"status": "online", "type": "AI Agent", "version": "1.0.0"}

@app.get("/license.txt", include_in_schema=False)
async def license():
    return HTMLResponse(content="License: MIT\nCopyright (c) 2026 Elite Realty", media_type="text/plain")

@app.get("/.well-known/acme-challenge/{token}", include_in_schema=False)
async def acme_challenge(token: str):
    # This is for SSL verification if needed. 
    # Usually handled by the platform, but returning 404 here is fine if not found.
    return JSONResponse(status_code=404, content={"detail": "Challenge not found"})

@app.post("/chat") 
def chat_endpoint(request: ChatRequest): 
    try: 
        # Ensure we have a valid session_id
        session_id = request.session_id or "default_session"
        
        # get_ai_response is a synchronous function that performs DB and LLM I/O.
        # By defining this endpoint with 'def' instead of 'async def', FastAPI
        # will run it in a separate threadpool, preventing the event loop from blocking.
        response_text = get_ai_response(
            request.message, 
            session_id=session_id,
            user_data=request.user_data,
            additional_context=request.additional_context
        ) 
        
        return { 
            "status": "success", 
            "response": response_text, 
            "agent": "EliteRealty-Bot" 
        } 
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e)) 

if __name__ == "__main__": 
    # Get port from environment variable for deployment (e.g., Railway)
    # Use a more robust way to get the port
    port_str = os.environ.get("PORT", "8000")
    try:
        port = int(port_str)
    except ValueError:
        # If PORT is not a valid integer (e.g. "$PORT"), fallback to 8000
        print(f"Warning: Invalid PORT '{port_str}', falling back to 8000")
        port = 8000
        
    # Run the server
    uvicorn.run(app, host="0.0.0.0", port=port)
