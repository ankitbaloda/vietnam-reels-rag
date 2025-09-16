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

# Load environment variables at startup
load_dotenv()

# Verify API keys are loaded
logger.info(f"OpenRouter API Key loaded: {'Yes' if os.getenv('OPENROUTER_API_KEY') else 'No'}")
logger.info(f"OpenAI API Key loaded: {'Yes' if os.getenv('OPENAI_API_KEY') else 'No'}")

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
    # Reload environment variables to ensure they're fresh
    load_dotenv()
    
    # Try OpenRouter first
    or_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    logger.info(f"Attempting OpenRouter with key: {or_key[:10]}..." if or_key else "No OpenRouter key found")
    
    if or_key:
        try:
            from openai import OpenAI
            base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
            headers = {}
            if os.getenv("OPENROUTER_SITE_URL"):
                headers["HTTP-Referer"] = os.getenv("OPENROUTER_SITE_URL")
            if os.getenv("OPENROUTER_APP_NAME"):
                headers["X-Title"] = os.getenv("OPENROUTER_APP_NAME")
            
            logger.info(f"Creating OpenRouter client with base_url: {base_url}")
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
    logger.info(f"Attempting OpenAI fallback with key: {openai_key[:10]}..." if openai_key else "No OpenAI key found")
    
    if openai_key:
        try:
            from openai import OpenAI
            return OpenAI(api_key=openai_key, timeout=120.0, max_retries=5)
        except Exception as e:
            logger.error(f"OpenAI client failed: {e}")
    
    logger.error("No valid API keys found in environment")
    raise HTTPException(status_code=500, detail="No valid API keys configured. Please check OPENROUTER_API_KEY or OPENAI_API_KEY in .env file")

async def fetch_openrouter_models():
    """Fetch models from OpenRouter API with enhanced provider detection and prioritization"""
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not openrouter_api_key:
        logger.warning("No OpenRouter API key found for model fetching")
        return []
    
    try:
        openrouter_base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        openrouter_site_url = os.getenv("OPENROUTER_SITE_URL", "")
        openrouter_app_name = os.getenv("OPENROUTER_APP_NAME", "")
        
        headers = {
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json"
        }
        if openrouter_site_url:
            headers["HTTP-Referer"] = openrouter_site_url
        if openrouter_app_name:
            headers["X-Title"] = openrouter_app_name
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{openrouter_base_url}/models", headers=headers)
            response.raise_for_status()
            data = response.json()
            
            models = []
            if "data" in data:
                # Define provider priority and recommended models
                provider_priority = {
                    "openai": 1,
                    "anthropic": 2, 
                    "google": 3,
                    "meta": 4,
                    "xai": 5,
                    "mistral": 6,
                    "cohere": 7,
                    "aws": 8,
                    "nvidia": 9,
                    "huggingface": 10
                }
                
                recommended_models = {
                    # 🚀 Latest 2025 Models (Highest Priority)
                    # ChatGPT-5 series
                    "openai/gpt-5": True,
                    "openai/gpt-5-mini": True,
                    "openai/gpt-5-turbo": True,
                    "openai/gpt-5-pro": True,
                    "openai/chatgpt-5": True,
                    "openai/o1-pro": True,
                    "openai/o1-max": True,
                    "openai/o1-preview-2025": True,
                    
                    # Claude 4 series  
                    "anthropic/claude-4": True,
                    "anthropic/claude-4-sonnet": True,
                    "anthropic/claude-4-opus": True,
                    "anthropic/claude-4-haiku": True,
                    "anthropic/claude-3.5-sonnet-20250101": True,
                    "anthropic/claude-3.5-opus": True,
                    
                    # Gemini 2.5/3.0 series
                    "google/gemini-2.5-pro": True,
                    "google/gemini-2.5-flash": True,
                    "google/gemini-3.0-pro": True,
                    "google/gemini-3.0-flash": True,
                    "google/gemini-2.0-flash-thinking": True,
                    
                    # Llama 4 series
                    "meta-llama/llama-4": True,
                    "meta-llama/llama-3.3": True,
                    "meta-llama/llama-3.2-405b": True,
                    "meta-llama/llama-3.2-90b": True,
                    
                    # Other 2025 models
                    "xai/grok-3": True,
                    "xai/grok-2.5": True,
                    "cohere/command-r-08-2025": True,
                    "mistralai/mixtral-8x22b-instruct-v0.3": True,
                    
                    # 📈 High Priority 2024 Models
                    # OpenAI
                    "openai/gpt-4o": True,
                    "openai/gpt-4o-mini": True,
                    "openai/gpt-4-turbo": True,
                    "openai/o1": True,
                    "openai/o1-mini": True,
                    "openai/o1-preview": True,
                    # Anthropic
                    "anthropic/claude-3.5-sonnet": True,
                    "anthropic/claude-3.5-haiku": True,
                    "anthropic/claude-3-opus": True,
                    # Google
                    "google/gemini-2.0-flash-exp": True,
                    "google/gemini-exp-1206": True,
                    "google/gemini-pro": True,
                    "google/gemini-1.5-pro": True,
                    # Meta
                    "meta-llama/llama-3.1-405b-instruct": True,
                    "meta-llama/llama-3.1-70b-instruct": True,
                    "meta-llama/llama-3.1-8b-instruct": True,
                    # xAI
                    "xai/grok-2": True,
                    "xai/grok-beta": True,
                    # Cohere
                    "cohere/command-r-plus": True,
                    # Mistral
                    "mistralai/mixtral-8x7b-instruct": True,
                    "mistralai/mistral-large": True
                }
                
                for model in data["data"]:
                    model_id = model.get("id", "")
                    
                    # Enhanced provider detection
                    provider = "Unknown"
                    if "/" in model_id:
                        provider_part = model_id.split("/")[0].lower()
                        if provider_part in ["openai"]:
                            provider = "OpenAI"
                        elif provider_part in ["anthropic"]:
                            provider = "Anthropic"
                        elif provider_part in ["google"]:
                            provider = "Google"
                        elif provider_part in ["meta-llama", "meta"]:
                            provider = "Meta"
                        elif provider_part in ["xai"]:
                            provider = "xAI"
                        elif provider_part in ["mistralai", "mistral"]:
                            provider = "Mistral"
                        elif provider_part in ["cohere"]:
                            provider = "Cohere"
                        elif provider_part in ["aws", "amazon"]:
                            provider = "AWS"
                        elif provider_part in ["nvidia"]:
                            provider = "NVIDIA"
                        elif provider_part in ["huggingface", "hf"]:
                            provider = "Hugging Face"
                        elif provider_part in ["qwen"]:
                            provider = "Alibaba"
                        elif provider_part in ["deepseek"]:
                            provider = "DeepSeek"
                        elif provider_part in ["01-ai"]:
                            provider = "01.AI"
                        else:
                            # Capitalize first letter of unknown providers
                            provider = provider_part.title()
                    
                    # Check if model is free (some OpenRouter models are free)
                    pricing = model.get("pricing", {})
                    prompt_cost = float(pricing.get("prompt", "0"))
                    completion_cost = float(pricing.get("completion", "0"))
                    is_free = prompt_cost == 0 and completion_cost == 0
                    
                    # Check if model is recommended
                    is_recommended = model_id in recommended_models
                    
                    # Check if it's a 2025 model based on model ID patterns
                    latest_2025_patterns = [
                        'gpt-5', 'chatgpt-5', 'o1-pro', 'o1-max', 'o1-preview-2025',
                        'claude-4', 'claude-3.5-sonnet-2025', 'claude-3.5-opus',
                        'gemini-2.5', 'gemini-3.0', 'gemini-2.0-flash-thinking',
                        'llama-4', 'llama-3.3', 'llama-3.2-405b', 'llama-3.2-90b',
                        'grok-3', 'grok-2.5', 'command-r-08-2025', 'mixtral-8x22b-instruct-v0.3'
                    ]
                    
                    is_2025_model = any(pattern in model_id.lower() for pattern in latest_2025_patterns)
                    
                    # Create enhanced label with special markers
                    base_label = model.get("name", model_id)
                    if is_2025_model:
                        enhanced_label = f"🚀 {base_label}"
                    elif is_recommended:
                        enhanced_label = f"⭐ {base_label}"
                    else:
                        enhanced_label = base_label
                    
                    model_item = {
                        "id": model_id,
                        "provider": provider,
                        "label": enhanced_label,
                        "free": is_free,
                        "paid": not is_free,
                        "recommended": is_recommended,
                        "is_2025_model": is_2025_model,
                        "context_length": model.get("context_length", 0),
                        "pricing": {
                            "prompt": prompt_cost,
                            "completion": completion_cost
                        }
                    }
                    models.append(model_item)
                
                # Sort models by priority: 2025 models first, then recommended, then by provider priority, then by name
                def sort_key(model):
                    provider_name = model["provider"].lower()
                    provider_rank = provider_priority.get(provider_name, 999)
                    is_2025_rank = 0 if model.get("is_2025_model", False) else 1
                    recommended_rank = 0 if model["recommended"] else 1
                    return (is_2025_rank, recommended_rank, provider_rank, model["label"].lower())
                
                models.sort(key=sort_key)
                
                logger.info(f"Successfully fetched {len(models)} models from OpenRouter")
                return models
                
    except Exception as e:
        logger.error(f"Failed to fetch models from OpenRouter: {e}")
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
    
    # Fallback models if OpenRouter fails - Updated 2025 models
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
        },
        {
            "id": "anthropic/claude-3-5-haiku",
            "provider": "Anthropic",
            "label": "Claude 3.5 Haiku",
            "free": False,
            "paid": True,
            "recommended": False
        },
        {
            "id": "google/gemini-2.0-flash",
            "provider": "Google",
            "label": "Gemini 2.0 Flash",
            "free": False,
            "paid": True,
            "recommended": True
        },
        {
            "id": "xai/grok-2",
            "provider": "xAI",
            "label": "Grok-2",
            "free": False,
            "paid": True,
            "recommended": False
        },
        {
            "id": "meta-llama/llama-3.1-405b-instruct",
            "provider": "Meta",
            "label": "Llama 3.1 405B Instruct", 
            "free": False,
            "paid": True,
            "recommended": False
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
        logger.info(f"Chat request for model: {request.model}")
        client = get_openai_client()
        
        # Prepare messages
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Make API call
        try:
            logger.info(f"Making API call with {len(messages)} messages")
            response = client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=4000
            )
            logger.info("API call successful")
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
        logger.info(f"RAG request for model: {request.model}, query: {request.query[:100]}...")
        # Import pipeline functions
        try:
            from scripts.run_pipeline import retrieve_context, get_openai_client as pipeline_client, chat_complete
        except ImportError:
            logger.warning("Pipeline not available, using fallback")
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