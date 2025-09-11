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

import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Reels RAG API", version="1.0.0")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://*.app.github.dev",
        "http://web:3000",
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

# OpenRouter/OpenAI client setup
def get_openai_client():
    """Get OpenAI-compatible client with OpenRouter primary, OpenAI fallback"""
    # Try OpenRouter first
    or_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if or_key:
        try:
            from openai import OpenAI
            base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
            headers = {}
            if os.getenv("OPENROUTER_SITE_URL"):
                headers["HTTP-Referer"] = os.getenv("OPENROUTER_SITE_URL")
            if os.getenv("OPENROUTER_APP_NAME"):
                headers["X-Title"] = os.getenv("OPENROUTER_APP_NAME")
            
            return OpenAI(
                base_url=base_url,
                api_key=or_key,
                default_headers=headers or None,
                timeout=120.0,
                max_retries=5
            )
        except Exception as e:
            logger.error(f"OpenRouter client failed: {e}")
    
    # Fallback to OpenAI
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        try:
            from openai import OpenAI
            return OpenAI(api_key=openai_key, timeout=120.0, max_retries=5)
        except Exception as e:
            logger.error(f"OpenAI client failed: {e}")
    
    raise HTTPException(status_code=500, detail="No valid API keys configured")

async def fetch_openrouter_models():
    """Fetch models from OpenRouter API"""
    or_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not or_key:
        return []
    
    try:
        base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        headers = {
            "Authorization": f"Bearer {or_key}",
            "Content-Type": "application/json"
        }
        if os.getenv("OPENROUTER_SITE_URL"):
            headers["HTTP-Referer"] = os.getenv("OPENROUTER_SITE_URL")
        if os.getenv("OPENROUTER_APP_NAME"):
            headers["X-Title"] = os.getenv("OPENROUTER_APP_NAME")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/models", headers=headers, timeout=60.0)
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("data", []):
                    models.append({
                        "id": model["id"],
                        "provider": model.get("provider", "Unknown"),
                        "label": model.get("name", model["id"]),
                        "free": model.get("pricing", {}).get("prompt", "0") == "0",
                        "paid": model.get("pricing", {}).get("prompt", "0") != "0",
                        "recommended": model["id"] in [
                            "openai/gpt-5-mini", "openai/gpt-4o-mini", 
                            "anthropic/claude-3-5-sonnet", "google/gemini-pro"
                        ]
                    })
                return models
    except Exception as e:
        logger.error(f"Failed to fetch OpenRouter models: {e}")
    
    return []

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "reels-rag-api"}

@app.get("/models")
async def get_models():
    """Get available models"""
    # Fetch from OpenRouter first, then add fallback models
    openrouter_models = await fetch_openrouter_models()
    
    # Fallback models if OpenRouter fails
    fallback_models = [
        {
            "id": "openai/gpt-5-mini",
            "provider": "OpenAI",
            "label": "GPT-5 Mini",
            "free": True,
            "paid": False,
            "recommended": True
        },
        {
            "id": "openai/gpt-4o-mini",
            "provider": "OpenAI",
            "label": "GPT-4o Mini",
            "free": False,
            "paid": True,
            "recommended": True
        },
        {
            "id": "anthropic/claude-3-5-sonnet",
            "provider": "Anthropic",
            "label": "Claude 3.5 Sonnet",
            "free": False,
            "paid": True,
            "recommended": True
        }
    ]
    
    models = openrouter_models if openrouter_models else fallback_models
    model_ids = [m["id"] for m in models]
    
    return {
        "models": model_ids,
        "items": models
    }

@app.post("/chat")
async def chat_completion(request: ChatRequest):
    """Generic chat completion endpoint"""
    try:
        client = get_openai_client()
        
        # Prepare messages
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Make API call
        try:
            response = client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=4000
            )
        except Exception as api_error:
            logger.error(f"API call failed: {api_error}")
            raise HTTPException(status_code=503, detail=f"LLM API unavailable: {str(api_error)}")
        
        response_content = response.choices[0].message.content or ""
        usage = {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0
        }
        
        # Save to history if session_id provided
        if request.session_id:
            save_chat_history(request.session_id, request.step, "user", request.messages[-1].content if request.messages else "")
            save_chat_history(request.session_id, request.step, "assistant", response_content, request.model)
        
        return {
            "choices": [{
                "message": {
                    "content": response_content
                }
            }],
            "usage": usage
        }
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat completion endpoint"""
    from fastapi.responses import StreamingResponse
    import json
    
    try:
        client = get_openai_client()
        
        # Prepare messages
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        def generate():
            try:
                # For now, return non-streaming response in SSE format
                response = client.chat.completions.create(
                    model=request.model,
                    messages=messages,
                    temperature=request.temperature,
                    max_tokens=4000
                )
                
                content = response.choices[0].message.content or ""
                
                # Send content as SSE
                yield f"event: message\ndata: {json.dumps({'delta': content})}\n\n"
                yield f"event: done\ndata: {json.dumps({'finish_reason': 'stop'})}\n\n"
                
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        logger.error(f"Chat stream error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/chat/stream")
async def rag_chat_stream(request: RAGRequest):
    """Streaming RAG chat endpoint"""
    from fastapi.responses import StreamingResponse
    import json
    
    try:
        def generate():
            try:
                # Import pipeline functions
                try:
                    from scripts.run_pipeline import retrieve_context, chat_complete
                    
                    # Get context
                    context = retrieve_context(request.query, top_k=request.top_k or 8)
                    system_prompt = f"You are a helpful assistant for travel content creation. Use the following context to answer questions:\n\n{context}"
                    
                    # Generate response
                    response_content = chat_complete(
                        system=system_prompt,
                        user=request.query,
                        model=request.model,
                        temperature=request.temperature or 0.7
                    )
                    
                    # Extract citations
                    citations = []
                    if context:
                        sources = []
                        for line in context.split('\n'):
                            if line.startswith('SOURCE:'):
                                source_name = line.replace('SOURCE:', '').strip()
                                if source_name not in sources:
                                    sources.append(source_name)
                                    citations.append({
                                        "source": source_name,
                                        "title": source_name.split('/')[-1],
                                        "excerpt": ""
                                    })
                    
                    # Send citations first
                    if citations:
                        yield f"event: context\ndata: {json.dumps({'citations': citations})}\n\n"
                    
                    # Send content
                    yield f"event: message\ndata: {json.dumps({'delta': response_content})}\n\n"
                    yield f"event: done\ndata: {json.dumps({'finish_reason': 'stop'})}\n\n"
                    
                except ImportError:
                    # Fallback without RAG
                    client = get_openai_client()
                    response = client.chat.completions.create(
                        model=request.model,
                        messages=[
                            {"role": "system", "content": "You are a helpful assistant for travel content creation."},
                            {"role": "user", "content": request.query}
                        ],
                        temperature=request.temperature,
                        max_tokens=4000
                    )
                    
                    content = response.choices[0].message.content or ""
                    yield f"event: message\ndata: {json.dumps({'delta': content})}\n\n"
                    yield f"event: done\ndata: {json.dumps({'finish_reason': 'stop'})}\n\n"
                    
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        logger.error(f"RAG stream error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/chat")
async def rag_chat(request: RAGRequest):
    """RAG-enabled chat endpoint"""
    try:
        # Import pipeline functions
        try:
            from scripts.run_pipeline import retrieve_context, get_openai_client as pipeline_client, chat_complete
        except ImportError:
            # Fallback if pipeline not available
            client = get_openai_client()
            try:
                response = client.chat.completions.create(
                    model=request.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant for travel content creation."},
                        {"role": "user", "content": request.query}
                    ],
                    temperature=request.temperature,
                    max_tokens=4000
                )
            except Exception as api_error:
                logger.error(f"RAG API call failed: {api_error}")
                raise HTTPException(status_code=503, detail=f"LLM API unavailable: {str(api_error)}")
            
            response_content = response.choices[0].message.content or ""
            usage = {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0
            }
            
            # Save to history if session_id provided
            if request.session_id:
                save_chat_history(request.session_id, request.step, "user", request.query)
                save_chat_history(request.session_id, request.step, "assistant", response_content, request.model)
            
            return {
                "choices": [{
                    "message": {
                        "content": response_content
                    }
                }],
                "citations": [],
                "usage": usage
            }
        
        # Use RAG pipeline
        context = retrieve_context(request.query, top_k=request.top_k or 8)
        system_prompt = f"You are a helpful assistant for travel content creation. Use the following context to answer questions:\n\n{context}"
        
        response_content = chat_complete(
            system=system_prompt,
            user=request.query,
            model=request.model,
            temperature=request.temperature or 0.7
        )
        
        # Extract citations from context
        citations = []
        if context:
            sources = []
            for line in context.split('\n'):
                if line.startswith('SOURCE:'):
                    source_name = line.replace('SOURCE:', '').strip()
                    if source_name not in sources:
                        sources.append(source_name)
                        citations.append({
                            "source": source_name,
                            "title": source_name.split('/')[-1],
                            "excerpt": ""
                        })
        
        # Save to history if session_id provided
        if request.session_id:
            save_chat_history(request.session_id, request.step, "user", request.query)
            save_chat_history(request.session_id, request.step, "assistant", response_content, request.model)
        
        return {
            "choices": [{
                "message": {
                    "content": response_content
                }
            }],
            "citations": citations,
            "usage": {
                "prompt_tokens": 200,  # Estimate
                "completion_tokens": 100  # Estimate
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
    try:
        from scripts.run_pipeline import stage_ideation
        import argparse
        
        # Create args object
        args = argparse.Namespace()
        args.topic = request.topic or "Vietnam travel reels"
        args.trip = request.trip
        args.persona = request.persona
        args.top_k = request.top_k or 8
        args.model = request.model or "openai/gpt-5-mini"
        args.temperature = request.temperature or 0.4
        args.session_id = request.session_id
        
        # Run ideation
        stage_ideation(args)
        
        # Read output
        from pathlib import Path
        output_file = Path("out/01_ideation_and_edl.md")
        content = output_file.read_text(encoding="utf-8") if output_file.exists() else "No output generated"
        
        return {
            "status": "success",
            "content": content,
            "file": "01_ideation_and_edl.md",
            "out_dir": "out"
        }
    except Exception as e:
        logger.error(f"Pipeline ideation error: {e}")
        return {"status": "error", "content": f"Error: {str(e)}", "file": None}

@app.post("/pipeline/outline") 
async def pipeline_outline(request: PipelineRequest):
    """Pipeline outline endpoint"""
    try:
        from scripts.run_pipeline import stage_outline
        import argparse
        
        args = argparse.Namespace()
        args.topic = request.topic or "Travel reel outline"
        args.trip = request.trip
        args.persona = request.persona
        args.top_k = request.top_k or 8
        args.model = request.model or "openai/gpt-5-mini"
        args.temperature = request.temperature or 0.4
        args.session_id = request.session_id
        args.prompt = request.prompt
        
        stage_outline(args)
        
        from pathlib import Path
        output_file = Path("out/01a_ideation_outline.md")
        content = output_file.read_text(encoding="utf-8") if output_file.exists() else "No output generated"
        
        return {
            "status": "success",
            "content": content,
            "file": "01a_ideation_outline.md"
        }
    except Exception as e:
        logger.error(f"Pipeline outline error: {e}")
        return {"status": "error", "content": f"Error: {str(e)}", "file": None}

@app.post("/pipeline/edl")
async def pipeline_edl(request: PipelineRequest):
    """Pipeline EDL endpoint"""
    try:
        from scripts.run_pipeline import stage_edl_from_outline
        import argparse
        
        args = argparse.Namespace()
        args.topic = request.topic
        args.trip = request.trip
        args.persona = request.persona
        args.outline = request.outline
        args.top_k = request.top_k or 8
        args.model = request.model or "openai/gpt-5-mini"
        args.temperature = request.temperature or 0.4
        args.session_id = request.session_id
        
        stage_edl_from_outline(args)
        
        from pathlib import Path
        output_file = Path("out/01b_edl_from_outline.md")
        content = output_file.read_text(encoding="utf-8") if output_file.exists() else "No output generated"
        
        return {
            "status": "success",
            "content": content,
            "file": "01b_edl_from_outline.md"
        }
    except Exception as e:
        logger.error(f"Pipeline EDL error: {e}")
        return {"status": "error", "content": f"Error: {str(e)}", "file": None}

@app.post("/pipeline/script")
async def pipeline_script(request: PipelineRequest):
    """Pipeline script endpoint"""
    try:
        from scripts.run_pipeline import stage_script
        import argparse
        
        args = argparse.Namespace()
        args.topic = request.topic
        args.trip = request.trip
        args.persona = request.persona
        args.outline = request.outline
        args.edl = request.edl
        args.script = request.script
        args.top_k = request.top_k or 8
        args.model = request.model or "openai/gpt-5-mini"
        args.temperature = request.temperature or 0.4
        args.session_id = request.session_id
        
        stage_script(args)
        
        from pathlib import Path
        output_file = Path("out/02_script_vipinclaude.md")
        content = output_file.read_text(encoding="utf-8") if output_file.exists() else "No output generated"
        
        return {
            "status": "success",
            "content": content,
            "file": "02_script_vipinclaude.md"
        }
    except Exception as e:
        logger.error(f"Pipeline script error: {e}")
        return {"status": "error", "content": f"Error: {str(e)}", "file": None}

@app.post("/pipeline/suno")
async def pipeline_suno(request: PipelineRequest):
    """Pipeline suno endpoint"""
    try:
        from scripts.run_pipeline import stage_suno
        import argparse
        
        args = argparse.Namespace()
        args.script = request.script
        args.suno = request.suno
        args.model = request.model or "openai/gpt-5-mini"
        args.temperature = request.temperature or 0.4
        args.session_id = request.session_id
        
        stage_suno(args)
        
        from pathlib import Path
        output_file = Path("out/03_suno_prompt.txt")
        content = output_file.read_text(encoding="utf-8") if output_file.exists() else "No output generated"
        
        return {
            "status": "success",
            "content": content,
            "file": "03_suno_prompt.txt"
        }
    except Exception as e:
        logger.error(f"Pipeline suno error: {e}")
        return {"status": "error", "content": f"Error: {str(e)}", "file": None}

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