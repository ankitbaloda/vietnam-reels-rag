from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import sqlite3
from datetime import datetime, timezone
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Reels RAG API", version="1.0.0")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://localhost:3000",
        "https://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
SQLITE_PATH = os.getenv("SQLITE_PATH", "database.sqlite")

def init_db():
    """Initialize SQLite database for chat history"""
    conn = sqlite3.connect(SQLITE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            step TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            model TEXT,
            ts INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Pydantic models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    session_id: Optional[str] = None
    step: Optional[str] = None

class RAGRequest(BaseModel):
    query: str
    model: str
    top_k: Optional[int] = 8
    temperature: Optional[float] = 0.7
    session_id: Optional[str] = None
    step: Optional[str] = None

class PipelineRequest(BaseModel):
    topic: Optional[str] = None
    trip: Optional[str] = None
    persona: Optional[str] = None
    prompt: Optional[str] = None
    outline: Optional[str] = None
    edl: Optional[str] = None
    script: Optional[str] = None
    suno: Optional[str] = None
    top_k: Optional[int] = 8
    model: Optional[str] = None
    temperature: Optional[float] = 0.4
    session_id: Optional[str] = None
    step: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "reels-rag-api"}

@app.get("/models")
async def get_models():
    """Get available models"""
    # Mock response for now - in production this would fetch from OpenRouter/OpenAI
    return {
        "models": ["gpt-4o-mini", "gpt-4", "claude-3-sonnet"],
        "items": [
            {
                "id": "gpt-4o-mini",
                "provider": "OpenAI",
                "label": "GPT-4o Mini",
                "free": True,
                "paid": False,
                "recommended": True
            },
            {
                "id": "gpt-4",
                "provider": "OpenAI", 
                "label": "GPT-4",
                "free": False,
                "paid": True,
                "recommended": True
            },
            {
                "id": "claude-3-sonnet",
                "provider": "Anthropic",
                "label": "Claude 3 Sonnet",
                "free": False,
                "paid": True,
                "recommended": False
            }
        ]
    }

@app.post("/chat")
async def chat_completion(request: ChatRequest):
    """Generic chat completion endpoint"""
    try:
        # Mock response for now
        response_content = f"This is a mock response for model {request.model}. In production, this would call the actual LLM API."
        
        # Save to history if session_id provided
        if request.session_id:
            save_chat_history(request.session_id, request.step, "assistant", response_content, request.model)
        
        return {
            "choices": [{
                "message": {
                    "content": response_content
                }
            }],
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50
            }
        }
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/chat")
async def rag_chat(request: RAGRequest):
    """RAG-enabled chat endpoint"""
    try:
        # Mock response for now
        response_content = f"This is a mock RAG response for query: {request.query[:100]}... Using model {request.model} with top_k={request.top_k}"
        
        # Save to history if session_id provided
        if request.session_id:
            save_chat_history(request.session_id, request.step, "assistant", response_content, request.model)
        
        return {
            "choices": [{
                "message": {
                    "content": response_content
                }
            }],
            "citations": [
                {
                    "source": "Travel Files Directory.csv",
                    "title": "Sample Travel Data",
                    "excerpt": "Mock citation from travel files..."
                }
            ],
            "usage": {
                "prompt_tokens": 150,
                "completion_tokens": 75
            }
        }
    except Exception as e:
        logger.error(f"RAG chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
async def get_history(
    session_id: str = Query(..., description="Session ID"),
    step: Optional[str] = Query(None, description="Step filter"),
    limit: int = Query(200, description="Maximum number of messages")
):
    """Get chat history for a session"""
    try:
        conn = sqlite3.connect(SQLITE_PATH)
        cursor = conn.cursor()
        
        if step:
            cursor.execute("""
                SELECT role, content, model, ts, step 
                FROM chat_history 
                WHERE session_id = ? AND step = ?
                ORDER BY ts DESC 
                LIMIT ?
            """, (session_id, step, limit))
        else:
            cursor.execute("""
                SELECT role, content, model, ts, step 
                FROM chat_history 
                WHERE session_id = ?
                ORDER BY ts DESC 
                LIMIT ?
            """, (session_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        messages = []
        for row in rows:
            messages.append({
                "role": row[0],
                "content": row[1],
                "model": row[2],
                "ts": row[3],
                "step": row[4]
            })
        
        return {
            "session_id": session_id,
            "step": step,
            "messages": messages
        }
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Pipeline endpoints
@app.post("/pipeline/ideation")
async def pipeline_ideation(request: PipelineRequest):
    """Pipeline ideation endpoint"""
    return {"status": "success", "content": "Mock ideation response", "file": "01_ideation.md"}

@app.post("/pipeline/outline") 
async def pipeline_outline(request: PipelineRequest):
    """Pipeline outline endpoint"""
    return {"status": "success", "content": "Mock outline response", "file": "01a_outline.md"}

@app.post("/pipeline/edl")
async def pipeline_edl(request: PipelineRequest):
    """Pipeline EDL endpoint"""
    return {"status": "success", "content": "Mock EDL response", "file": "01b_edl.md"}

@app.post("/pipeline/script")
async def pipeline_script(request: PipelineRequest):
    """Pipeline script endpoint"""
    return {"status": "success", "content": "Mock script response", "file": "02_script.md"}

@app.post("/pipeline/suno")
async def pipeline_suno(request: PipelineRequest):
    """Pipeline suno endpoint"""
    return {"status": "success", "content": "Mock suno prompt", "file": "03_suno.txt"}

def save_chat_history(session_id: str, step: Optional[str], role: str, content: str, model: Optional[str] = None):
    """Save chat message to history"""
    try:
        conn = sqlite3.connect(SQLITE_PATH)
        cursor = conn.cursor()
        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        cursor.execute("""
            INSERT INTO chat_history (session_id, step, role, content, model, ts)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, step, role, content, model, ts))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to save chat history: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)