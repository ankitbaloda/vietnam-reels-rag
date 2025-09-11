from fastapi import FastAPI, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Dict, Any, Optional, List, Tuple
import os
import httpx
import json
import math
import sqlite3
from datetime import datetime, timezone
from qdrant_client import QdrantClient
from qdrant_client.models import Filter as QFilter, FieldCondition, MatchValue
import re
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
CHAT_URL = f"{OPENROUTER_BASE_URL}/chat/completions"
RESPONSES_URL = f"{OPENROUTER_BASE_URL}/responses"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "openai/text-embedding-3-large")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip()
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "flowise_reels")
DB_PATH = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "database.sqlite"))

app = FastAPI(title="Reels RAG API", version="0.1.0")

# CORS for local dev and simple hosting (tune for prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- SQLite helpers for session history ----
def _now_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ensure_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            step TEXT NOT NULL,
            role TEXT NOT NULL,
            model TEXT,
            content TEXT NOT NULL,
            ts TEXT NOT NULL,
            meta TEXT
        )
        """
    )
    conn.commit()


def _get_db() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    _ensure_db(conn)
    return conn


def _record_message(session_id: Optional[str], step: Optional[str], role: str, content: str, model: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> None:
    if not session_id or not step or not content:
        return
    try:
        conn = _get_db()
        conn.execute(
            "INSERT INTO sessions_messages (session_id, step, role, model, content, ts, meta) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, step, role, model, content, _now_ts(), json.dumps(meta or {})),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        # Non-fatal: log and continue
        print(f"DB record error: {e}")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def index() -> Dict[str, Any]:
    return {
        "name": "Reels RAG API",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "prompts": {
                "ideation": {"path": "/prompts/ideation", "method": "GET"}
            },
            "pipeline": {
                "outline": {"path": "/pipeline/outline", "method": "POST"},
                "ideation": {"path": "/pipeline/ideation", "method": "POST"},
                "edl_from_outline": {"path": "/pipeline/edl", "method": "POST"},
                "script": {"path": "/pipeline/script", "method": "POST"},
                "suno": {"path": "/pipeline/suno", "method": "POST"}
            },
            "chat": {
                "path": "/chat",
                "method": "POST",
                "example": {
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "You are helpful."},
                        {"role": "user", "content": "Say hi in one short line."}
                    ],
                    "temperature": 0
                }
            },
            "models": "/models",
        },
    }


@app.get("/prompts/ideation")
async def get_ideation_prompt() -> Dict[str, Any]:
    try:
        repo_root = os.path.dirname(os.path.dirname(__file__))
        prompt_path = os.path.join(repo_root, "prompts", "01a_ideation_outline_no_edl.md")
        with open(prompt_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"name": "ideation", "path": prompt_path, "content": content}
    except Exception as e:
        return JSONResponse({"error": f"Failed to read ideation prompt: {e}"}, status_code=500)


@app.post("/chat")
async def chat(
    payload: Dict[str, Any] = Body(..., description="Chat payload with messages, model, temperature, max tokens"),
    model: Optional[str] = Query(None, description="OpenRouter model id, e.g., openai/gpt-5-mini"),
    session_id: Optional[str] = Query(None, description="Optional session id (also allowed in body)"),
    step: Optional[str] = Query(None, description="Optional step id (ideation|outline|edl|script|suno|handoff|chat)"),
):
    # prefer explicit model provided
    selected_model = model or payload.get("model") or os.getenv("OPENAI_CHAT_MODEL", "openai/gpt-5-mini")
    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        return JSONResponse({"error": "No API keys configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY."}, status_code=400)

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    # Optional attribution headers
    site = os.getenv("OPENROUTER_SITE_URL")
    app_name = os.getenv("OPENROUTER_APP_NAME")
    if site:
        headers["HTTP-Referer"] = site
    if app_name:
        headers["X-Title"] = app_name

    body = {
        "model": selected_model,
        "messages": payload.get("messages") or [],
        "stream": bool(payload.get("stream", False)),
    }

    # Handle temperature parameter - some models don't support it
    temperature = payload.get("temperature", 0)
    if temperature != 0 and selected_model.startswith("openai/gpt-5"):
        # GPT-5 models may not support non-zero temperature
        temperature = 0
    body["temperature"] = temperature

    # Optional token limits - handle both OpenAI and OpenRouter formats
    if isinstance(payload.get("max_tokens"), int):
        body["max_tokens"] = int(payload["max_tokens"])
    if isinstance(payload.get("max_output_tokens"), int):
        body["max_output_tokens"] = int(payload["max_output_tokens"])

    # Add other common parameters that OpenRouter supports
    for param in ["top_p", "top_k", "frequency_penalty", "presence_penalty", "stop"]:
        if param in payload:
            body[param] = payload[param]

    # Resolve session and step
    session_id = session_id or payload.get("session_id")
    step = step or payload.get("step") or "chat"

    # Pre-record latest user message if present
    try:
        msgs = payload.get("messages") or []
        if session_id and msgs:
            for m in reversed(msgs):
                if m.get("role") == "user":
                    _record_message(session_id, step, "user", str(m.get("content") or ""), selected_model)
                    break
    except Exception:
        pass

    async with httpx.AsyncClient(timeout=60) as client:
        # Try OpenRouter first if key present
        if OPENROUTER_API_KEY:
            try:
                r = await client.post(CHAT_URL, headers=headers, json=body)
                if r.status_code < 400:
                    response_data = r.json()
                    # Normalize response format for compatibility
                    if "choices" not in response_data and "output" in response_data:
                        response_data = {
                            "choices": [{"message": {"role": "assistant", "content": response_data["output"]}}],
                            "usage": response_data.get("usage", {})
                        }
                    # Record assistant
                    try:
                        content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        _record_message(session_id, step, "assistant", str(content), selected_model, {"usage": response_data.get("usage")})
                    except Exception:
                        pass
                    return JSONResponse(response_data)
            except Exception as e:
                # Log the error for debugging
                print(f"OpenRouter /chat/completions failed: {e}")

            # Some OpenRouter models require the /responses endpoint; try that
            try:
                resp_body = {
                    "model": body.get("model"),
                    # responses endpoint accepts "input"; pass both for compatibility
                    "input": body.get("messages") or [],
                    "messages": body.get("messages") or [],
                    "temperature": body.get("temperature", 0),
                    "max_output_tokens": body.get("max_output_tokens") or body.get("max_tokens"),
                }
                # Copy other parameters if they exist
                for param in ["top_p", "top_k", "frequency_penalty", "presence_penalty", "stop"]:
                    if param in body:
                        resp_body[param] = body[param]

                r_alt = await client.post(RESPONSES_URL, headers=headers, json=resp_body)
                if r_alt.status_code < 400:
                    data_alt = r_alt.json()
                    # Normalize different response formats
                    content = data_alt.get("output") or data_alt.get("output_text") or data_alt.get("text") or ""
                    if not content and "choices" in data_alt:
                        content = data_alt["choices"][0]["message"]["content"]

                    normalized_response = {
                        "choices": [{"message": {"role": "assistant", "content": content}}],
                        "usage": data_alt.get("usage", {}),
                        "model": data_alt.get("model", selected_model)
                    }
                    # Record assistant
                    try:
                        _record_message(session_id, step, "assistant", str(content), selected_model, {"usage": data_alt.get("usage")})
                    except Exception:
                        pass
                    return JSONResponse(normalized_response)
            except Exception as e:
                print(f"OpenRouter /responses failed: {e}")
            # if OpenRouter fails and OpenAI is available, fall back
            if OPENAI_API_KEY:
                pass  # fallthrough to OpenAI block below
            else:
                try:
                    # return most informative error
                    try_alt = r.json()
                    return JSONResponse(try_alt, status_code=r.status_code)
                except Exception:
                    return JSONResponse({"error": r.text}, status_code=r.status_code)

        # OpenAI fallback (non-OpenRouter). Only for known OpenAI models to avoid pattern issues.
        if OPENAI_API_KEY:
            try:
                oai_url = "https://api.openai.com/v1/chat/completions"
                oai_headers = {
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                }
                # Map model names if user provided openrouter-style
                fallback_model = selected_model
                if "/" in fallback_model:
                    # Handle different provider prefixes
                    if fallback_model.startswith("openai/"):
                        fallback_model = fallback_model.split("/", 1)[1]
                    else:
                        # For non-OpenAI models, map to a reasonable default for reliability
                        fallback_model = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")

                # Expanded allowlist of OpenAI Chat Completions models
                allowed = {
                    "gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo", "gpt-4-turbo-preview",
                    "gpt-3.5-turbo", "gpt-3.5-turbo-16k",
                    "o1", "o1-mini", "o1-pro", "o1-preview",
                    "o3", "o3-mini", "o3-mini-high", "o3-pro",
                    "o4-mini", "o4-mini-high",
                    "gpt-5", "gpt-5-mini",  # Include preview models
                }

                if fallback_model not in allowed:
                    return JSONResponse({
                        "error": f"Model '{selected_model}' is not in the OpenAI allowlist. Supported models: {', '.join(sorted(allowed))}",
                        "provider": "openai",
                        "supported_models": sorted(allowed)
                    }, status_code=400)

                oai_body = {**body, "model": fallback_model}

                # Handle parameter compatibility for different OpenAI models
                if fallback_model.startswith("o1") or fallback_model.startswith("o3") or fallback_model.startswith("o4"):
                    # Reasoning models don't support system messages in the same way
                    if "messages" in oai_body:
                        # Convert system message to user message if needed
                        messages = oai_body["messages"]
                        if messages and messages[0].get("role") == "system":
                            system_content = messages[0]["content"]
                            messages[0] = {"role": "user", "content": f"System: {system_content}"}

                # Translate responses-style param to OpenAI's max_tokens
                if "max_output_tokens" in oai_body and "max_tokens" not in oai_body:
                    oai_body["max_tokens"] = int(oai_body.pop("max_output_tokens"))

                r2 = await client.post(oai_url, headers=oai_headers, json=oai_body)
                if r2.status_code >= 400:
                    try:
                        error_data = r2.json()
                        return JSONResponse({
                            "error": error_data.get("error", {}).get("message", "OpenAI API error"),
                            "provider": "openai",
                            "model": fallback_model,
                            "status_code": r2.status_code
                        }, status_code=r2.status_code)
                    except Exception:
                        return JSONResponse({
                            "error": r2.text,
                            "provider": "openai",
                            "status_code": r2.status_code
                        }, status_code=r2.status_code)
                data2 = r2.json()
                try:
                    content = data2.get("choices", [{}])[0].get("message", {}).get("content", "")
                    _record_message(session_id, step, "assistant", str(content), fallback_model, {"usage": data2.get("usage")})
                except Exception:
                    pass
                return JSONResponse(data2)
            except Exception as e:
                return JSONResponse({
                    "error": f"OpenAI fallback failed: {str(e)}",
                    "provider": "openai",
                    "model": fallback_model
                }, status_code=500)

        # Should not reach here
        return JSONResponse({"error": "No providers responded."}, status_code=502)


def _safe_truncate(text: str, max_chars: int = 1200) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3] + "..."


_TAG_RE = re.compile(r"<[^>]+>")
def _strip_html(text: str) -> str:
    try:
        if not isinstance(text, str):
            return str(text)
        if "</" in text or text.startswith("<"):
            # Remove tags and collapse whitespace
            s = _TAG_RE.sub("", text)
            return re.sub(r"\s+", " ", s).strip()
        return text
    except Exception:
        return text


async def _embed_query(text: str) -> List[float]:
    model = EMBEDDINGS_MODEL
    # If model is namespaced (provider/model), prefer OpenRouter
    if "/" in model and OPENROUTER_API_KEY:
        try:
            url = f"{OPENROUTER_BASE_URL}/embeddings"
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            }
            site = os.getenv("OPENROUTER_SITE_URL")
            app_name = os.getenv("OPENROUTER_APP_NAME")
            if site:
                headers["HTTP-Referer"] = site
            if app_name:
                headers["X-Title"] = app_name
            payload = {"model": model, "input": text}
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
                return data["data"][0]["embedding"]
        except Exception:
            # fall through to OpenAI
            pass
    # OpenAI direct
    if not OPENAI_API_KEY:
        raise RuntimeError("Embeddings require either OPENROUTER_API_KEY (namespaced model) or OPENAI_API_KEY.")
    oai_model = model.split("/", 1)[1] if "/" in model else model
    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"model": oai_model, "input": text}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return data["data"][0]["embedding"]


def _format_contexts(matches) -> Tuple[str, List[Dict[str, Any]]]:
    lines: List[str] = []
    cites: List[Dict[str, Any]] = []
    for i, m in enumerate(matches, start=1):
        payload = m.payload or {}
        txt = payload.get("text") or payload.get("content") or ""
        src = payload.get("source") or payload.get("path") or payload.get("file") or payload.get("doc") or ""
        title = payload.get("title") or payload.get("doc_title") or ""
        line = f"[{i}] {title+ ' - ' if title else ''}{_safe_truncate(txt, 500)}"
        if src:
            line += f"\nSource: {src}"
        lines.append(line)
        cites.append({"id": i, "source": src, "title": title})
    return "\n\n".join(lines), cites


@app.post("/rag/chat")
async def rag_chat(payload: Dict[str, Any] = Body(...)):
    """Grounded chat using Qdrant retrieval and LLM generation.
    Expects: { query: string, model?: string, top_k?: int, temperature?: number }
    Returns OpenRouter-like { choices: [{ message: { role, content } }] } for UI compatibility.
    """
    query: str = (payload.get("query") or payload.get("prompt") or "").strip()
    if not query:
        return JSONResponse({"error": "Missing 'query'"}, status_code=400)
    top_k: int = int(payload.get("top_k") or 6)
    model = payload.get("model") or os.getenv("OPENAI_CHAT_MODEL", "openai/gpt-4o-mini")
    temperature = payload.get("temperature", 0.2)
    max_tokens = payload.get("max_tokens")
    max_output_tokens = payload.get("max_output_tokens")
    # Optional system override
    system_override = (payload.get("system") or "").strip()

    # Resolve session and step
    session_id: Optional[str] = payload.get("session_id")
    step: str = payload.get("step") or "chat"

    # Pre-record user query
    try:
        if session_id:
            _record_message(session_id, step, "user", query, model)
    except Exception:
        pass

    # Embed query
    vector = await _embed_query(query)

    # Retrieve from Qdrant
    client = QdrantClient(url=QDRANT_URL, api_key=(QDRANT_API_KEY or None))
    search_res = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=vector,
        limit=top_k,
        with_payload=True,
        with_vectors=False,
    )
    # Ensure key required sources are present in SOURCES even if not in top_k
    try:
        required_files = [
            "Travel Files Directory.csv",
            "Vietnam Daywise Narrations Transcripts.txt",
            "vietnam_trip_costs - Trip Cost (Audience).csv",
            "Master_Viral_Travel_Reels_Playbook.txt",
        ]
        present_names = set()
        for m in search_res:
            try:
                nm = (m.payload or {}).get("source_name") or (m.payload or {}).get("source") or ""
                if nm:
                    present_names.add(nm)
            except Exception:
                pass
        augmented = list(search_res)
        for fname in required_files:
            if fname in present_names:
                continue
            try:
                filt = QFilter(must=[FieldCondition(key="source_name", match=MatchValue(value=fname))])
                extra = client.search(
                    collection_name=QDRANT_COLLECTION,
                    query_vector=vector,
                    limit=min(3, max(1, top_k // 8)),
                    with_payload=True,
                    with_vectors=False,
                    query_filter=filt,
                )
                if extra:
                    augmented.extend(extra)
            except Exception:
                # non-fatal
                pass
        # Deduplicate by (source_name, chunk_index) to avoid repeats
        seen = set()
        deduped = []
        for m in augmented:
            p = m.payload or {}
            key = (p.get("source_name") or p.get("source") or "", p.get("chunk_index"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(m)
        search_res = deduped
    except Exception:
        # If augmentation fails, continue with original results
        pass
    context_str, citations = _format_contexts(search_res)

    if not context_str.strip():
        msg = "No sources found for your query. Please rephrase or index more content."
        return JSONResponse({"choices": [{"message": {"role": "assistant", "content": msg}}]})

    # If no override and step-specific prompt exists, use it (ideation -> 01a_ideation_outline_no_edl.md)
    system_msg = None
    if system_override:
        system_msg = system_override
    else:
        if step == "ideation":
            try:
                repo_root = os.path.dirname(os.path.dirname(__file__))
                prompt_path = os.path.join(repo_root, "prompts", "01a_ideation_outline_no_edl.md")
                with open(prompt_path, "r", encoding="utf-8") as f:
                    system_msg = f.read()
            except Exception:
                system_msg = None
    if not system_msg:
        system_msg = (
            "You are an expert Reels ideation assistant. Answer strictly grounded in the SOURCES given. "
            "Do not fabricate. If the sources are insufficient, say you need more context. "
            "Write in concise, readable Hinglish. Include short headings and bullet points."
        )
    user_msg = (
        f"User Query:\n{query}\n\nSOURCES (cite like [1], [2]):\n{context_str}"
    )

    # Call LLM via same routing (OpenRouter first, then OpenAI allowlist)
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        "temperature": temperature,
    }
    if isinstance(max_tokens, int):
        body["max_tokens"] = int(max_tokens)
    if isinstance(max_output_tokens, int):
        body["max_output_tokens"] = int(max_output_tokens)

    # Reuse chat path
    # Inline minimal call to avoid double wrapping and to also try /responses
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    site = os.getenv("OPENROUTER_SITE_URL")
    app_name = os.getenv("OPENROUTER_APP_NAME")
    if site:
        headers["HTTP-Referer"] = site
    if app_name:
        headers["X-Title"] = app_name

    async with httpx.AsyncClient(timeout=60) as client_http:
        if OPENROUTER_API_KEY:
            try:
                r = await client_http.post(CHAT_URL, headers=headers, json=body)
            except Exception as e:
                r = None
                # fall through to /responses or fallback
            html_problem_text: Optional[str] = None
            if r is not None and r.status_code < 400:
                # Some OpenRouter errors return a 200 HTML page (e.g., model not available)
                ctype = (r.headers.get("content-type") or "").lower()
                body_text = (r.text or "").strip()
                looks_html = ("text/html" in ctype) or body_text.startswith("<!DOCTYPE html") or body_text.startswith("<html")
                if not looks_html:
                    try:
                        data = r.json()
                        # If provider returns a structured JSON but with HTML content, treat as error
                        content_try = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")
                        if isinstance(content_try, str) and content_try.lstrip().startswith("<"):
                            html_problem_text = (content_try or "")[:400]
                        else:
                            # Attach citations if missing
                            if "citations" not in data:
                                data["citations"] = citations
                            try:
                                _record_message(session_id, step, "assistant", str(content_try), model, {"citations": citations})
                            except Exception:
                                pass
                            # Sanitize content in-place
                            try:
                                if isinstance(data.get("choices"), list) and data["choices"]:
                                    msg = data["choices"][0].get("message", {})
                                    if isinstance(msg.get("content"), str):
                                        msg["content"] = _strip_html(msg["content"]) if msg["content"].lstrip().startswith("<") else msg["content"]
                                        data["choices"][0]["message"] = msg
                            except Exception:
                                pass
                            return JSONResponse(data)
                    except Exception:
                        # If JSON parsing fails and body looks like HTML, capture a short snippet as error detail
                        looks_html = body_text.startswith("<")
                if looks_html:
                    html_problem_text = body_text[:400]
                else:
                    # Non-HTML, non-JSON unexpected content — treat as text error and continue
                    html_problem_text = body_text[:400]
            # try responses
            resp_body = {
                "model": model,
                "input": body.get("messages") or [],
                "messages": body.get("messages") or [],
                "temperature": temperature,
                "max_output_tokens": body.get("max_output_tokens") or body.get("max_tokens"),
            }
            try:
                r2 = await client_http.post(RESPONSES_URL, headers=headers, json=resp_body)
            except Exception as e:
                r2 = None
            if r2 is not None and r2.status_code < 400:
                # Guard against HTML responses here as well
                ctype2 = (r2.headers.get("content-type") or "").lower()
                body_text2 = (r2.text or "").strip()
                looks_html2 = ("text/html" in ctype2) or body_text2.startswith("<!DOCTYPE html") or body_text2.startswith("<html")
                if not looks_html2:
                    try:
                        data = r2.json()
                        content = data.get("output") or data.get("output_text") or data.get("text") or ""
                        if not content and "choices" in data:
                            content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")
                    except Exception:
                        content = (r2.text or "").strip()
                    # Avoid returning raw HTML content
                    if isinstance(content, str) and content.lstrip().startswith("<"):
                        html_problem_text = (content or "")[:400]
                    else:
                        out = {
                            "choices": [{"message": {"role": "assistant", "content": _strip_html(content)}}],
                            "citations": citations,
                        }
                        try:
                            _record_message(session_id, step, "assistant", str(content), model, {"citations": citations})
                        except Exception:
                            pass
                        return JSONResponse(out)
                else:
                    # responses endpoint returned HTML; preserve a short snippet for error context
                    if not html_problem_text:
                        html_problem_text = body_text2[:400]
            # If both OpenRouter calls failed, attempt to return a helpful error unless OpenAI fallback is configured
            if not OPENAI_API_KEY:
                status = (r and r.status_code) or (r2 and r2.status_code) or 502
                return JSONResponse({
                    "error": "OpenRouter request failed",
                    "detail": (html_problem_text or "") or "Non-JSON response from provider",
                    "hint": "The selected model might not be available. Try a different model like openai/gpt-4o-mini.",
                }, status_code=status)
        # Fallback to OpenAI for allowlisted models
        if OPENAI_API_KEY:
            try:
                oai_url = "https://api.openai.com/v1/chat/completions"
                oai_headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
                # Prefer OpenAI if available; map non-openai/* to a safe default
                if model.startswith("openai/"):
                    fallback_model = model.split("/", 1)[1]
                else:
                    fallback_model = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")
                allowed = {
                    "gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo",
                    "o1", "o1-mini", "o1-pro", "o3", "o3-mini", "o3-mini-high", "o3-pro", "o4-mini", "o4-mini-high",
                    # Include preview GPT-5 variants for parity with /chat endpoint
                    "gpt-5", "gpt-5-mini",
                }
                if fallback_model not in allowed:
                    return JSONResponse({"error": "Model not supported via OpenAI fallback."}, status_code=400)
                oai_body = {**body, "model": fallback_model}
                if "max_output_tokens" in oai_body and "max_tokens" not in oai_body:
                    oai_body["max_tokens"] = int(oai_body.pop("max_output_tokens"))
                r3 = await client_http.post(oai_url, headers=oai_headers, json=oai_body)
                if r3.status_code < 400:
                    data = r3.json()
                    try:
                        content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")
                        _record_message(session_id, step, "assistant", str(content), fallback_model, {"citations": citations})
                    except Exception:
                        pass
                    return JSONResponse(data)
                return JSONResponse(r3.json(), status_code=r3.status_code)
            except Exception as e:
                return JSONResponse({"error": f"OpenAI fallback failed: {e}"}, status_code=500)

    return JSONResponse({"error": "No providers responded."}, status_code=502)


def _sse_format(event: str, data: Dict[str, Any]) -> str:
    try:
        return f"event: {event}\n" + "data: " + json.dumps(data, ensure_ascii=False) + "\n\n"
    except Exception:
        # Fallback to string
        return f"event: {event}\n" + "data: {}\n\n"


@app.post("/chat/stream")
async def chat_stream(
    payload: Dict[str, Any] = Body(...),
    model: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    step: Optional[str] = Query(None),
):
    selected_model = model or payload.get("model") or os.getenv("OPENAI_CHAT_MODEL", "openai/gpt-4o-mini")
    messages = payload.get("messages") or []
    temperature = payload.get("temperature", 0)
    session_id = session_id or payload.get("session_id")
    step = step or payload.get("step") or "chat"

    # Pre-record latest user
    try:
        for m in reversed(messages):
            if m.get("role") == "user":
                _record_message(session_id, step, "user", str(m.get("content") or ""), selected_model)
                break
    except Exception:
        pass

    async def event_generator():
        nonlocal selected_model
        # Prefer OpenRouter streaming
        if OPENROUTER_API_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                }
                site = os.getenv("OPENROUTER_SITE_URL")
                app_name = os.getenv("OPENROUTER_APP_NAME")
                if site:
                    headers["HTTP-Referer"] = site
                if app_name:
                    headers["X-Title"] = app_name
                body = {"model": selected_model, "messages": messages, "temperature": temperature, "stream": True}
                async with httpx.AsyncClient(timeout=None) as client_http:
                    async with client_http.stream("POST", CHAT_URL, headers=headers, json=body) as r:
                        if r.status_code >= 400:
                            try:
                                data = await r.aread()
                                yield _sse_format("error", {"error": data.decode(errors='ignore')[:500]})
                            except Exception:
                                yield _sse_format("error", {"error": f"HTTP {r.status_code}"})
                            yield _sse_format("done", {"finish_reason": "error"})
                            return
                        # Stream provider events, normalize to message/done
                        async for line in r.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                payload_str = line[len("data: "):].strip()
                                if payload_str == "[DONE]":
                                    yield _sse_format("done", {"finish_reason": "stop"})
                                    return
                                try:
                                    obj = json.loads(payload_str)
                                    # OpenAI-style delta
                                    delta = (
                                        obj.get("choices", [{}])[0]
                                        .get("delta", {})
                                        .get("content")
                                    )
                                    if isinstance(delta, str) and delta:
                                        yield _sse_format("message", {"delta": _strip_html(delta)})
                                except Exception:
                                    # Unknown chunk; ignore quietly
                                    pass
                        # If stream ended without explicit DONE
                        yield _sse_format("done", {"finish_reason": "stop"})
                        return
            except Exception as e:
                yield _sse_format("error", {"error": f"OpenRouter stream failed: {str(e)}"})
                # fall through to OpenAI
        if not OPENAI_API_KEY:
            return
        # OpenAI streaming fallback
        try:
            oai_headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
            fallback_model = selected_model.split("/", 1)[1] if "/" in selected_model else selected_model
            oai_body = {"model": fallback_model, "messages": messages, "temperature": temperature, "stream": True}
            async with httpx.AsyncClient(timeout=None) as client_http:
                async with client_http.stream("POST", "https://api.openai.com/v1/chat/completions", headers=oai_headers, json=oai_body) as r2:
                    if r2.status_code >= 400:
                        try:
                            data = await r2.aread()
                            yield _sse_format("error", {"error": data.decode(errors='ignore')[:500]})
                        except Exception:
                            yield _sse_format("error", {"error": f"HTTP {r2.status_code}"})
                        yield _sse_format("done", {"finish_reason": "error"})
                        return
                    async for line in r2.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            payload_str = line[len("data: "):].strip()
                            if payload_str == "[DONE]":
                                yield _sse_format("done", {"finish_reason": "stop"})
                                return
                            try:
                                obj = json.loads(payload_str)
                                delta = obj.get("choices", [{}])[0].get("delta", {}).get("content")
                                if isinstance(delta, str) and delta:
                                    yield _sse_format("message", {"delta": _strip_html(delta)})
                            except Exception:
                                pass
                    yield _sse_format("done", {"finish_reason": "stop"})
        except Exception as e:
            yield _sse_format("error", {"error": f"OpenAI stream failed: {str(e)}"})
            yield _sse_format("done", {"finish_reason": "error"})

    headers = {"Cache-Control": "no-cache", "Connection": "keep-alive"}
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@app.post("/rag/chat/stream")
async def rag_chat_stream(payload: Dict[str, Any] = Body(...)):
    query: str = (payload.get("query") or payload.get("prompt") or "").strip()
    if not query:
        return JSONResponse({"error": "Missing 'query'"}, status_code=400)
    top_k: int = int(payload.get("top_k") or 6)
    model = payload.get("model") or os.getenv("OPENAI_CHAT_MODEL", "openai/gpt-4o-mini")
    temperature = payload.get("temperature", 0.2)
    session_id: Optional[str] = payload.get("session_id")
    step: str = payload.get("step") or "chat"

    try:
        if session_id:
            _record_message(session_id, step, "user", query, model)
    except Exception:
        pass

    vector = await _embed_query(query)
    client = QdrantClient(url=QDRANT_URL, api_key=(QDRANT_API_KEY or None))
    search_res = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=vector,
        limit=top_k,
        with_payload=True,
        with_vectors=False,
    )
    # augment as in JSON path
    try:
        required_files = [
            "Travel Files Directory.csv",
            "Vietnam Daywise Narrations Transcripts.txt",
            "vietnam_trip_costs - Trip Cost (Audience).csv",
            "Master_Viral_Travel_Reels_Playbook.txt",
        ]
        present_names = set()
        for m in search_res:
            nm = (m.payload or {}).get("source_name") or (m.payload or {}).get("source") or ""
            if nm:
                present_names.add(nm)
        augmented = list(search_res)
        for fname in required_files:
            if fname in present_names:
                continue
            try:
                filt = QFilter(must=[FieldCondition(key="source_name", match=MatchValue(value=fname))])
                extra = client.search(
                    collection_name=QDRANT_COLLECTION,
                    query_vector=vector,
                    limit=min(3, max(1, top_k // 8)),
                    with_payload=True,
                    with_vectors=False,
                    query_filter=filt,
                )
                if extra:
                    augmented.extend(extra)
            except Exception:
                pass
        seen = set()
        deduped = []
        for m in augmented:
            p = m.payload or {}
            key = (p.get("source_name") or p.get("source") or "", p.get("chunk_index"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(m)
        search_res = deduped
    except Exception:
        pass

    context_str, citations = _format_contexts(search_res)
    if not context_str.strip():
        def empty_gen():
            yield _sse_format("message", {"delta": "No sources found for your query. Please rephrase or index more content."})
            yield _sse_format("done", {"finish_reason": "stop"})
        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    system_msg = None
    try:
        if (payload.get("system") or "").strip():
            system_msg = payload.get("system")
        elif (payload.get("step") or "") == "ideation":
            repo_root = os.path.dirname(os.path.dirname(__file__))
            prompt_path = os.path.join(repo_root, "prompts", "01a_ideation_outline_no_edl.md")
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_msg = f.read()
    except Exception:
        system_msg = None
    if not system_msg:
        system_msg = (
            "You are an expert Reels ideation assistant. Answer strictly grounded in the SOURCES given. "
            "Do not fabricate. If the sources are insufficient, say you need more context. "
            "Write in concise, readable Hinglish. Include short headings and bullet points."
        )
    user_msg = f"User Query:\n{query}\n\nSOURCES (cite like [1], [2]):\n{context_str}"

    async def event_generator():
        # Emit citations up-front so client can show Sources panel immediately
        yield _sse_format("context", {"citations": citations})
        # Then stream the model
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }
        site = os.getenv("OPENROUTER_SITE_URL")
        app_name = os.getenv("OPENROUTER_APP_NAME")
        if site:
            headers["HTTP-Referer"] = site
        if app_name:
            headers["X-Title"] = app_name
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            "temperature": temperature,
            "stream": True,
        }
        if OPENROUTER_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=None) as client_http:
                    async with client_http.stream("POST", CHAT_URL, headers=headers, json=body) as r:
                        if r.status_code >= 400:
                            txt = (await r.aread()).decode(errors='ignore')[:500]
                            yield _sse_format("error", {"error": txt})
                            yield _sse_format("done", {"finish_reason": "error"})
                            return
                        async for line in r.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                payload_str = line[len("data: "):].strip()
                                if payload_str == "[DONE]":
                                    yield _sse_format("done", {"finish_reason": "stop"})
                                    try:
                                        _record_message(session_id, step, "assistant", "(streamed)", model, {"citations": citations})
                                    except Exception:
                                        pass
                                    return
                                try:
                                    obj = json.loads(payload_str)
                                    delta = obj.get("choices", [{}])[0].get("delta", {}).get("content")
                                    if isinstance(delta, str) and delta:
                                        yield _sse_format("message", {"delta": _strip_html(delta)})
                                except Exception:
                                    pass
                        yield _sse_format("done", {"finish_reason": "stop"})
                        return
            except Exception as e:
                yield _sse_format("error", {"error": f"OpenRouter stream failed: {str(e)}"})
        if OPENAI_API_KEY:
            try:
                oai_headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
                fallback_model = model.split("/", 1)[1] if "/" in model else model
                oai_body = {"model": fallback_model, "messages": body["messages"], "temperature": temperature, "stream": True}
                async with httpx.AsyncClient(timeout=None) as client_http:
                    async with client_http.stream("POST", "https://api.openai.com/v1/chat/completions", headers=oai_headers, json=oai_body) as r2:
                        if r2.status_code >= 400:
                            txt = (await r2.aread()).decode(errors='ignore')[:500]
                            yield _sse_format("error", {"error": txt})
                            yield _sse_format("done", {"finish_reason": "error"})
                            return
                        async for line in r2.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                payload_str = line[len("data: "):].strip()
                                if payload_str == "[DONE]":
                                    yield _sse_format("done", {"finish_reason": "stop"})
                                    try:
                                        _record_message(session_id, step, "assistant", "(streamed)", model, {"citations": citations})
                                    except Exception:
                                        pass
                                    return
                                try:
                                    obj = json.loads(payload_str)
                                    delta = obj.get("choices", [{}])[0].get("delta", {}).get("content")
                                    if isinstance(delta, str) and delta:
                                        yield _sse_format("message", {"delta": _strip_html(delta)})
                                except Exception:
                                    pass
                        yield _sse_format("done", {"finish_reason": "stop"})
                        return
            except Exception as e:
                yield _sse_format("error", {"error": f"OpenAI stream failed: {str(e)}"})
                yield _sse_format("done", {"finish_reason": "error"})

    headers = {"Cache-Control": "no-cache", "Connection": "keep-alive"}
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@app.get("/history")
async def get_history(
    session_id: str = Query(..., description="Session ID"),
    step: Optional[str] = Query(None, description="Optional step filter"),
    limit: int = Query(200, description="Max records to return"),
):
    try:
        conn = _get_db()
        if step:
            cur = conn.execute(
                "SELECT role, content, model, ts, step FROM sessions_messages WHERE session_id = ? AND step = ? ORDER BY id DESC LIMIT ?",
                (session_id, step, limit),
            )
        else:
            cur = conn.execute(
                "SELECT role, content, model, ts, step FROM sessions_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            )
        rows = [
            {"role": r[0], "content": r[1], "model": r[2], "ts": r[3], "step": r[4]}
            for r in cur.fetchall()
        ]
        conn.close()
        return {"session_id": session_id, "step": step, "messages": list(reversed(rows))}
    except Exception as e:
        return JSONResponse({"error": f"DB read failed: {e}"}, status_code=500)


@app.get("/models")
async def models(provider: Optional[str] = Query(None, description="Filter by provider namespace, e.g. openai, anthropic, google")) -> Dict[str, Any]:
    """Return available model IDs from OpenRouter; falls back to a small curated list.
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    site = os.getenv("OPENROUTER_SITE_URL")
    app_name = os.getenv("OPENROUTER_APP_NAME")
    if site:
        headers["HTTP-Referer"] = site
    if app_name:
        headers["X-Title"] = app_name

    # Static fallback list including requested GPT-5 variants
    fallback = [
        "openai/gpt-5",
        "openai/gpt-5-mini",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.7-sonnet",
        "anthropic/claude-3.7",
        "anthropic/claude-3-haiku",
        "google/gemini-1.5-pro",
        "google/gemini-1.5-flash",
    ]

    # If no key, return fallback (optionally filtered)
    if not OPENROUTER_API_KEY:
        models = [m for m in fallback if (not provider or m.startswith(provider + "/"))]
        return {"source": "static", "models": models}

    url = f"{OPENROUTER_BASE_URL}/models"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, headers=headers)
            if r.status_code >= 400:
                # return fallback on error
                models = [m for m in fallback if (not provider or m.startswith(provider + "/"))]
                items = [
                    {
                        "id": m,
                        "provider": m.split("/", 1)[0] if "/" in m else "",
                        "label": m,
                        "free": m.endswith(":free"),
                        "paid": not m.endswith(":free"),
                        "recommended": m in {"openai/gpt-5","openai/gpt-5-mini","openai/gpt-4o","openai/gpt-4o-mini","anthropic/claude-3.7-sonnet","google/gemini-2.5-pro","google/gemini-2.5-flash"},
                    }
                    for m in models
                ]
                return {"source": "static", "models": models, "items": items, "error": r.text}
            data = r.json()
            # OpenRouter returns { data: [{ id: "provider/model", pricing: {prompt, completion} ...}, ...] }
            raw_items = data.get("data") or data.get("models") or []
            ids = []
            items = []
            for it in raw_items:
                mid = (it.get("id") or it.get("name") or "").strip()
                if not mid:
                    continue
                if provider and not mid.startswith(provider + "/"):
                    continue
                ids.append(mid)
                pricing = it.get("pricing") or {}
                prompt_p = pricing.get("prompt")
                comp_p = pricing.get("completion")
                is_free = False
                try:
                    # treat 0 or '0' as free
                    is_free = (str(prompt_p) == "0" or str(comp_p) == "0") or mid.endswith(":free")
                except Exception:
                    is_free = mid.endswith(":free")
                items.append({
                    "id": mid,
                    "provider": mid.split("/", 1)[0] if "/" in mid else "",
                    "label": it.get("name") or mid,
                    "free": bool(is_free),
                    "paid": not bool(is_free),
                    "recommended": mid in {"openai/gpt-5","openai/gpt-5-mini","openai/gpt-4o","openai/gpt-4o-mini","anthropic/claude-3.7-sonnet","google/gemini-2.5-pro","google/gemini-2.5-flash"},
                })
            # Ensure unique and add fallback GPT-5 variants if missing (requested)
            for extra in ["openai/gpt-5", "openai/gpt-5-mini"]:
                if (not provider or extra.startswith(provider + "/")) and extra not in ids:
                    ids.append(extra)
                    items.append({
                        "id": extra,
                        "provider": "openai",
                        "label": extra,
                        "free": False,
                        "paid": True,
                        "recommended": True,
                    })
            return {"source": "openrouter", "models": sorted(set(ids)), "items": items}
    except Exception as e:
        models = [m for m in fallback if (not provider or m.startswith(provider + "/"))]
        return {"source": "static", "models": models, "error": f"{e}"}


# ----- Pipeline endpoints (outline, edl_from_outline, script, suno) -----
try:
    # Import the CLI stages so we can call them programmatically
    from scripts.run_pipeline import build_parser, stage_outline, stage_edl_from_outline, stage_script, stage_suno, stage_ideation  # type: ignore
except Exception:
    stage_outline = None  # type: ignore
    stage_edl_from_outline = None  # type: ignore
    stage_script = None  # type: ignore
    stage_suno = None  # type: ignore
    stage_ideation = None  # type: ignore


def _default_model() -> str:
    return os.getenv("OPENAI_CHAT_MODEL", "openai/gpt-5-mini")


def _run_stage(stage_fn, payload: Dict[str, Any]) -> Dict[str, Any]:
    if stage_fn is None:
        return {"error": "Pipeline not available on server. Ensure scripts.run_pipeline is importable."}
    # Map JSON to argparse-like namespace
    from types import SimpleNamespace
    args = SimpleNamespace(
        stage=payload.get("stage"),
        topic=payload.get("topic"),
        trip=payload.get("trip"),
        persona=payload.get("persona"),
        prompt=payload.get("prompt"),
        script=payload.get("script"),
        outline=payload.get("outline"),
        idea=payload.get("idea"),
        edl=payload.get("edl"),
        suno=payload.get("suno"),
        top_k=int(payload.get("top_k") or 8),
        model=payload.get("model") or _default_model(),
        temperature=float(payload.get("temperature") or 0.4),
        session_id=payload.get("session_id"),
    )
    # Invoke the stage; they write artifacts to out/
    stage_fn(args)
    # Return pointers to artifacts
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "out")
    return {"status": "ok", "out_dir": out_dir}


@app.post("/pipeline/outline")
async def api_outline(payload: Dict[str, Any] = Body(...)):
    """Run Step 1 Outline. Body supports: topic, trip, persona, prompt, top_k, model, temperature, session_id."""
    res = _run_stage(stage_outline, payload)
    # Attach latest artifact content
    out_dir = res.get("out_dir")
    artifact = os.path.join(out_dir, "01a_ideation_outline.md")
    content = ""
    try:
        with open(artifact, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        pass
    # record to history if session
    try:
        sid = payload.get("session_id")
        if sid and content:
            _record_message(sid, payload.get("step") or "outline", "assistant", content, payload.get("model"))
    except Exception:
        pass
    return JSONResponse({**res, "file": artifact, "content": content})


@app.post("/pipeline/ideation")
async def api_ideation(payload: Dict[str, Any] = Body(...)):
    """Run single-pass 01 Ideation + EDL (legacy combined). Body supports: topic, trip, persona, top_k, model."""
    res = _run_stage(stage_ideation, payload)
    out_dir = res.get("out_dir")
    artifact = os.path.join(out_dir, "01_ideation_and_edl.md")
    content = ""
    try:
        with open(artifact, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        pass
    try:
        sid = payload.get("session_id")
        if sid and content:
            _record_message(sid, payload.get("step") or "ideation", "assistant", content, payload.get("model"))
    except Exception:
        pass
    return JSONResponse({**res, "file": artifact, "content": content})


@app.post("/pipeline/edl")
async def api_edl(payload: Dict[str, Any] = Body(...)):
    """Run Step 2 EDL from Outline. Body supports: outline (path optional), topic, trip, persona, top_k, model."""
    res = _run_stage(stage_edl_from_outline, payload)
    out_dir = res.get("out_dir")
    artifact = os.path.join(out_dir, "01b_edl_from_outline.md")
    content = ""
    try:
        with open(artifact, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        pass
    try:
        sid = payload.get("session_id")
        if sid and content:
            _record_message(sid, payload.get("step") or "edl", "assistant", content, payload.get("model"))
    except Exception:
        pass
    return JSONResponse({**res, "file": artifact, "content": content})


@app.post("/pipeline/script")
async def api_script(payload: Dict[str, Any] = Body(...)):
    """Run Step 3 Script. Body supports: outline/edl (paths optional), top_k, model, persona, trip."""
    res = _run_stage(stage_script, payload)
    out_dir = res.get("out_dir")
    artifact = os.path.join(out_dir, "02_script_vipinclaude.md")
    content = ""
    try:
        with open(artifact, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        pass
    try:
        sid = payload.get("session_id")
        if sid and content:
            _record_message(sid, payload.get("step") or "script", "assistant", content, payload.get("model"))
    except Exception:
        pass
    return JSONResponse({**res, "file": artifact, "content": content})


@app.post("/pipeline/suno")
async def api_suno(payload: Dict[str, Any] = Body(...)):
    """Generate SUNO prompt from a script or idea."""
    res = _run_stage(stage_suno, payload)
    out_dir = res.get("out_dir")
    artifact = os.path.join(out_dir, "03_suno_prompt.txt")
    content = ""
    try:
        with open(artifact, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        pass
    try:
        sid = payload.get("session_id")
        if sid and content:
            _record_message(sid, payload.get("step") or "suno", "assistant", content, payload.get("model"))
    except Exception:
        pass
    return JSONResponse({**res, "file": artifact, "content": content})
