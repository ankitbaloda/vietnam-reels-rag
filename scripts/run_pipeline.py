#!/usr/bin/env python3
import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Optional, Dict, Set, Any

from dotenv import load_dotenv

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchText
except Exception:
    QdrantClient = None  # type: ignore


ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = ROOT / "prompts"
OUT_DIR = ROOT / "out"
RUNS_DIR = OUT_DIR / "runs"
INITIAL_DIR = OUT_DIR / "initial"
FINAL_DIR = OUT_DIR / "final"
REQUIRED_SOURCES: Set[str] = {
    "Travel Files Directory.csv",
    "Vietnam Daywise Narrations Transcripts.txt",
    "vietnam_trip_costs - Trip Cost (Audience).csv",
    "Master_Viral_Travel_Reels_Playbook.txt",
}


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def load_prompt(name: str, fallback: str = "") -> str:
    p = PROMPTS_DIR / name
    txt = read_text(p).strip()
    return txt if txt else fallback.strip()


def get_openai_client() -> Any:
    """Return an OpenAI-compatible client with enhanced provider support.

    Supports multiple modes:
    - OpenRouter proxy (preferred) using OPENROUTER_API_KEY
    - Native OpenAI using OPENAI_API_KEY
    - Automatic fallback and error handling
    """
    if OpenAI is None:
        raise RuntimeError("openai package not installed. pip install -r requirements.txt")

    load_dotenv()

    # Check for OpenRouter first (preferred)
    or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if or_key:
        try:
            base_url = (os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").strip()
            # Optional headers for attribution and better rate limiting
            default_headers = {}
            site = os.getenv("OPENROUTER_SITE_URL")
            app = os.getenv("OPENROUTER_APP_NAME")
            if site:
                default_headers["HTTP-Referer"] = site
            if app:
                default_headers["X-Title"] = app

            # Add timeout and retry configuration
            client = OpenAI(
                base_url=base_url,
                api_key=or_key,
                default_headers=default_headers or None,
                timeout=60.0,  # 60 second timeout
                max_retries=3,  # Retry failed requests
            )
            print(f"Using OpenRouter client with base URL: {base_url}")
            return client
        except Exception as e:
            print(f"Failed to initialize OpenRouter client: {e}")
            # Fall through to OpenAI

    # Fallback to OpenAI
    key = (os.getenv("OPENAI_API_KEY") or "").strip().replace("\u202f", "").replace("\xa0", "")
    if not key:
        raise RuntimeError(
            "No API keys found. Please set either:\n"
            "- OPENROUTER_API_KEY for OpenRouter access (recommended)\n"
            "- OPENAI_API_KEY for direct OpenAI access"
        )

    try:
        os.environ["OPENAI_API_KEY"] = key
        client = OpenAI(timeout=60.0, max_retries=3)
        print("Using OpenAI client (fallback)")
        return client
    except Exception as e:
        raise RuntimeError(f"Failed to initialize OpenAI client: {e}")


def get_qdrant_client() -> Optional[Any]:
    if QdrantClient is None:
        return None
    # Prefer docker service hostname by default so containers can reach Qdrant reliably
    url = os.getenv("QDRANT_URL", "http://qdrant:6333")
    api_key = os.getenv("QDRANT_API_KEY")
    # Try primary URL and verify connectivity; if it fails, try localhost
    for candidate in [url, "http://localhost:6333"]:
        try:
            client = QdrantClient(url=candidate, api_key=api_key, prefer_grpc=False, timeout=15, check_compatibility=False)
            # lightweight probe
            _ = client.get_collections()
            return client
        except Exception:
            continue
    return None


def embed(client: Any, text: str, model: str) -> List[float]:
    """Create embeddings with graceful OpenRouter compatibility.

    If routing via OpenRouter, some OpenAI models must be namespaced
    (e.g., "openai/text-embedding-3-large"). Try the given model first,
    then fall back to the namespaced variant when appropriate.
    """
    try:
        resp = client.embeddings.create(model=model, input=text)
        return resp.data[0].embedding  # type: ignore
    except Exception:
        # Fallback: if running through OpenRouter and model is OpenAI embeddings,
        # try namespacing (openai/<model>)
        try:
            or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
            if or_key and "/" not in model and model.startswith("text-embedding"):
                namespaced = f"openai/{model}"
                resp = client.embeddings.create(model=namespaced, input=text)
                return resp.data[0].embedding  # type: ignore
        except Exception:
            pass
        # Last resort: try a smaller embedding model variant if available
        try:
            fallback = "text-embedding-3-small"
            if os.getenv("OPENROUTER_API_KEY"):
                fallback = f"openai/{fallback}"
            resp = client.embeddings.create(model=fallback, input=text)
            return resp.data[0].embedding  # type: ignore
        except Exception:
            # Give up; caller will handle retrieval fallback
            raise


def retrieve_context(query: str, top_k: int = 8, trip: Optional[str] = None, persona: Optional[str] = None) -> str:
    qdrant = get_qdrant_client()
    if qdrant is None:
        return ""
    collection = os.getenv("QDRANT_COLLECTION", "flowise_reels")
    emb_model = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-large")
    client = get_openai_client()
    try:
        # 1) Try semantic search first
        vec: Optional[List[float]] = None
        try:
            vec = embed(client, query, emb_model)
        except Exception:
            vec = None

        points = []
        if vec is not None:
            try:
                # Fetch a wider pool to allow client-side filtering; then downselect
                points = list(qdrant.search(collection_name=collection, query_vector=vec, limit=max(top_k * 3, 24)))
            except Exception:
                points = []

        chunks: List[str] = []
        seen_sources: Set[str] = set()
        source_counts: Dict[str, int] = {}

        # If any required sources are missing in initial hits, try to fetch at least 1 per missing source
        def annotate(payload: Dict) -> Optional[str]:
            text = payload.get("text") or payload.get("content") or payload.get("chunk")
            if not text:
                return None
            source_name = payload.get("source_name") or payload.get("file_path") or "unknown"
            short = str(source_name).split("/")[-1]
            seen_sources.add(short)
            source_counts[short] = source_counts.get(short, 0) + 1
            return f"SOURCE: {source_name}\n{text}"

        # filtering helpers
        def matches_filters(payload: Dict) -> bool:
            # Persona is a POV for generation; do not filter retrieval by persona.
            if not trip:
                return True
            txt = (payload.get("text") or "").lower()
            row_trip = (payload.get("row_trip") or "").lower()
            file_path = (payload.get("file_path") or payload.get("source_name") or "").lower()
            t = (trip or "").lower()
            return (t in row_trip) or (t in txt) or (t in file_path)

        for p in points:
            pl = p.payload or {}
            if matches_filters(pl):
                line = annotate(pl)
                if line:
                    chunks.append(line)

        missing = [s for s in REQUIRED_SOURCES if s not in seen_sources]
        for name in missing:
            try:
                # Fallback: scroll to get any one point from this source regardless of semantic similarity
                filt_must = [FieldCondition(key="source_name", match=MatchValue(value=name))]
                scrolled, _ = qdrant.scroll(
                    collection_name=collection,
                    limit=1,
                    scroll_filter=Filter(must=filt_must),
                    with_payload=True,
                )
                if scrolled:
                    payload = scrolled[0].payload or {}
                    srcn = payload.get("source_name") or payload.get("file_path") or name
                    _ = annotate(payload)  # updates seen_sources & counts
                    line = f"SOURCE: {srcn}\n{payload.get('text') or payload.get('content') or payload.get('chunk') or ''}"
                    chunks.append(line)
            except Exception:
                pass

        # 3) Enforce per-source minimum quotas to improve coverage breadth
        min_quota = {
            "Master_Viral_Travel_Reels_Playbook.txt": 3,
            "Vietnam Daywise Narrations Transcripts.txt": 3,
            "Travel Files Directory.csv": 4,
            "vietnam_trip_costs - Trip Cost (Audience).csv": 2,
        }
        for name, q in min_quota.items():
            short = name
            have = source_counts.get(short, 0)
            need = max(0, q - have)
            if need <= 0:
                continue
            try:
                filt_must = [FieldCondition(key="source_name", match=MatchValue(value=name))]
                scrolled, _ = qdrant.scroll(
                    collection_name=collection,
                    limit=need,
                    scroll_filter=Filter(must=filt_must),
                    with_payload=True,
                )
                for pt in scrolled or []:
                    payload = pt.payload or {}
                    line = annotate(payload)
                    if line:
                        chunks.append(line)
            except Exception:
                pass

        # Build a presence summary to satisfy the guard
        presence = {s: ("Present" if s in seen_sources else "Missing") for s in REQUIRED_SOURCES}
        header = "Context sources presence: " + ", ".join([f"{k}={v}" for k, v in sorted(presence.items())])
        return header + "\n\n" + "\n\n".join(chunks)
    except Exception:
        return ""


def _supports_temperature(model: str) -> bool:
    """Check if a model supports temperature parameter"""
    m = (model or "").lower().strip()

    # Models that don't support temperature
    no_temp_models = {
        "gpt-5", "gpt-5-mini",  # GPT-5 family
        "o1", "o1-mini", "o1-pro", "o1-preview",  # OpenAI o1 models
        "o3", "o3-mini", "o3-mini-high", "o3-pro",  # OpenAI o3 models
        "o4-mini", "o4-mini-high",  # OpenAI o4 models
    }

    # Check for exact matches or prefixes
    for no_temp_model in no_temp_models:
        if m == no_temp_model or m.startswith(f"{no_temp_model}-"):
            return False

    return True


def chat_complete(system: str, user: str, model: str = "gpt-4o-mini", temperature: float = 0.4) -> str:
    """Enhanced chat completion with better model compatibility"""
    client = get_openai_client()

    # Prepare messages based on model type
    messages = []
    if model.startswith(("o1", "o3", "o4")) or model.startswith("openai/o1") or model.startswith("openai/o3") or model.startswith("openai/o4"):
        # Reasoning models: combine system and user messages
        combined_content = f"System: {system}\n\nUser: {user}"
        messages = [{"role": "user", "content": combined_content}]
    else:
        # Standard models: separate system and user messages
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": messages,
    }

    # Handle temperature parameter
    if _supports_temperature(model):
        kwargs["temperature"] = temperature
    else:
        # For models that don't support temperature, ensure it's not set
        pass

    # Do not force max_tokens. Allow provider/model defaults or explicit user limits.

    try:
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""
    except Exception as e:
        print(f"Chat completion failed for model {model}: {e}")
        # Return a fallback response
        return f"Error: Failed to get response from {model}. {str(e)}"


def stage_ideation(args: argparse.Namespace) -> None:
    # Session/memory
    session_id = getattr(args, "session_id", None)
    if session_id:
        try:
            from scripts.session_utils import append_history, load_state, save_state, persist_artifact, compute_idea_fingerprint  # type: ignore
        except Exception:
            from session_utils import append_history, load_state, save_state, persist_artifact, compute_idea_fingerprint  # type: ignore
        state = load_state(session_id)
    else:
        append_history = None  # type: ignore
        save_state = None  # type: ignore
        state = {}
    guard = load_prompt("00_ingest_guardrail.md", fallback="You are a careful, helpful assistant.")
    ideation = load_prompt("01_ideation_and_edl.md", fallback=(
        "Generate 5 high-converting short video hook ideas for the given travel topic. "
        "Then create a concise EDL (shot list with durations)."
    ))
    topic = args.topic or "Vietnam travel reels"
    # Infer filters from topic if not explicitly provided
    auto_trip = None
    auto_persona = None
    low = topic.lower()
    for kw in ["vietnam","maldives","ladakh"]:
        if kw in low:
            auto_trip = kw
            break
    if "vipin" in low and "divya" in low:
        auto_persona = None  # both
    elif "vipin" in low:
        auto_persona = "Vipin"
    elif "divya" in low:
        auto_persona = "Divya"
    trip = args.trip or auto_trip
    persona = args.persona or auto_persona
    context = retrieve_context(topic, top_k=args.top_k, trip=trip, persona=persona)
    # Load user preferences if available to bias generation
    pref_path = ROOT / "data" / "feedback" / "preferences.json"
    pref_hint = ""
    try:
        if pref_path.exists():
            pref = json.loads(pref_path.read_text(encoding="utf-8"))
            pref_hint = "\n\nUser Preference Hints:" \
                        f"\n- Like rate: {pref.get('like_rate')}" \
                        f"\n- Hook types: {list((pref.get('hook_types') or {}).keys())[:5]}" \
                        f"\n- Media preference: {pref.get('media_type_pref')}" \
                        f"\n- Duration pref: {pref.get('duration_pref')}" \
                        f"\n- Cuts/30s mean: {(pref.get('cuts_per_30s') or {}).get('mean')}"
    except Exception:
        pass
    # Include index coverage snapshot if available to help the assistant verify presence
    coverage = {}
    try:
        cov_txt = read_text(OUT_DIR / "index_report.json")
        if cov_txt:
            coverage = json.loads(cov_txt)
    except Exception:
        pass
    coverage_note = "\n\nIndex coverage: " + json.dumps(coverage.get("by_file", {})) if coverage else ""
    # Infer requested idea count only if explicitly stated as N ideas; otherwise default to 1 full idea
    import re
    idea_count = 1
    m = re.search(r"(\d+)\s*ideas?\b", topic, flags=re.I)
    if m:
        idea_count = int(m.group(1))
    elif re.search(r"\b(one|single)\s+(full\s+)?idea\b", topic, flags=re.I):
        idea_count = 1
    idea_count_note = f"Requested idea count: {idea_count}"
    task_directive = (
        "\n\nTask directives:"\
        f"\n- Produce exactly {idea_count} grounded idea card(s). If the Topic explicitly specifies a different number of ideas, follow that instead."\
        "\n- Cover the whole Vietnam trip with diverse locations/days when possible (avoid two ideas from the same micro-spot)."\
        "\n- Follow Playbook density: 16–24 cuts per 30s baseline; hook burst, steady mid, payoff spike."\
    "\n- EDL Alignment must be provided now, per mini-chapter. Allocate total shots across chapters. For ~30s include ≥8 shots; for ~60s include ≥16 shots."\
    "\n- For each shot, provide exactly ONE best candidate clip with filename, clip_id, and full story_description; prefer videos over photos."\
    "\n- Add a short Reasoning section: why these ideas and clips (reference enrichment_input_raw themes and day-wise beats)."\
        "\n- Preserve Hinglish in hooks/examples."\
    )
    filter_note = "" if (not trip and not persona) else f"\n\nApplied filters: trip={trip or 'any'}, persona={persona or 'both'}"
    # Dedup hint: if session tracks finalized idea fingerprints, instruct model to avoid repeating
    dedup_note = ""
    finalized = []
    if session_id and isinstance(state, dict):
        finalized = list(set((state.get("finalized_ideas") or [])))
        if finalized:
            dedup_note = "\n\nAvoid these fingerprints (already finalized):\n- " + "\n- ".join(finalized)
    user = f"Topic: {topic}\n{idea_count_note}{filter_note}{dedup_note}\n\nRetrieved context (annotated):\n{context}{coverage_note}{task_directive}{pref_hint}\n\nInstructions:\n{ideation}"
    # If presence shows no Missing, replace strict guard with a productive system message to avoid false 'Nothing'
    if "presence:" in context.lower() and "Missing" not in context:
        guard = (
            "System:\n"
            "You generate grounded Idea Cards and EDLs for travel reels using the retrieved context.\n"
            "- Use ONLY retrieved content (clips, day-wise narrations, costs, playbook).\n"
            "- Preserve Hinglish and code-mixed phrases.\n"
            "- If any key detail is ambiguous or missing, ask 1–2 brief clarifying questions, then proceed.\n"
            "- Do NOT return the word 'Nothing'. If context is insufficient, ask questions.\n"
            "Status: Proceed. All required sources are loaded and present."
        )
    # Debug dump
    # Create a run folder for this execution
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    run_dir = RUNS_DIR / ts
    try:
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "DEBUG_ideation_prompt.txt").write_text(
            "SYSTEM:\n" + guard + "\n\nUSER:\n" + user,
            encoding="utf-8",
        )
    except Exception:
        pass
    # Record history
    if session_id and append_history:
        try:
            append_history(session_id, "ideation", "system", guard)
            append_history(session_id, "ideation", "user", user)
        except Exception:
            pass
    out = chat_complete(guard, user, model=args.model, temperature=args.temperature)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "01_ideation_and_edl.md").write_text(out, encoding="utf-8")
    from datetime import datetime
    ts_initial = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (INITIAL_DIR / f"ideation_{ts_initial}.md").write_text(out, encoding="utf-8")
    # Persist artifact into session and update state with fresh candidate fingerprint
    if session_id:
        try:
            p = persist_artifact(session_id, "ideation", "01_ideation_and_edl.md", out)
            # compute and store candidate fingerprint for dedup (based on Title + Summary section if present)
            import re
            m = re.search(r"Title\s*\(.*?\)\s*:\s*(.*)\n.*?Idea Summary\s*\n-\s*(.*)", out, flags=re.S|re.I)
            idea_key = (m.group(1) + " | " + m.group(2)) if m else out[:400]
            fp = compute_idea_fingerprint(idea_key)
            state.setdefault("candidates", []).append({"ts": ts_initial, "file": str(p), "fp": fp})
            if save_state:
                save_state(session_id, state)
        except Exception:
            pass
    try:
        (run_dir / "01_ideation_and_edl.md").write_text(out, encoding="utf-8")
    except Exception:
        pass
    print("Wrote out/01_ideation_and_edl.md and run snapshot")


def stage_outline(args: argparse.Namespace) -> None:
    # Session/memory
    session_id = getattr(args, "session_id", None)
    if session_id:
        try:
            from scripts.session_utils import append_history, load_state, save_state, persist_artifact, compute_idea_fingerprint  # type: ignore
        except Exception:
            from session_utils import append_history, load_state, save_state, persist_artifact, compute_idea_fingerprint  # type: ignore
        state = load_state(session_id)
    else:
        append_history = None  # type: ignore
        save_state = None  # type: ignore
        state = {}

    guard = load_prompt("00_ingest_guardrail.md", fallback="You are a careful, helpful assistant.")
    # Allow overriding the outline prompt to test variants without changing defaults
    if getattr(args, "prompt", None):
        system_outline = read_text(Path(args.prompt))
        if not system_outline:
            system_outline = load_prompt("01a_ideation_outline.md", fallback=(
                "Generate an Idea Card and Storyline with mini-chapters and a per-chapter shots summary (counts/intents). Do not create a full EDL in this step."
            ))
    else:
        system_outline = load_prompt("01a_ideation_outline.md", fallback=(
        "Generate an Idea Card and Storyline with mini-chapters and a per-chapter shots summary (counts/intents). Do not create a full EDL in this step."
        ))
    topic = args.topic or "Travel reel idea outline"

    # Infer filters from topic
    auto_trip = None
    low = topic.lower()
    for kw in ["vietnam","maldives","ladakh"]:
        if kw in low:
            auto_trip = kw
            break
    trip = args.trip or auto_trip
    persona = args.persona or ("vipin" if "vipin" in low else ("divya" if "divya" in low else None))
    context = retrieve_context(topic, top_k=args.top_k, trip=trip, persona=persona)

    # Preferences hint
    pref_path = ROOT / "data" / "feedback" / "preferences.json"
    pref_hint = ""
    try:
        if pref_path.exists():
            pref = json.loads(pref_path.read_text(encoding="utf-8"))
            pref_hint = "\n\nUser Preference Hints:" \
                        f"\n- Hook types: {list((pref.get('hook_types') or {}).keys())[:5]}" \
                        f"\n- Media preference: {pref.get('media_type_pref')}" \
                        f"\n- Duration pref: {pref.get('duration_pref')}"
    except Exception:
        pass

    # Coverage note
    coverage = {}
    try:
        cov_txt = read_text(OUT_DIR / "index_report.json")
        if cov_txt:
            coverage = json.loads(cov_txt)
    except Exception:
        pass
    coverage_note = "\n\nIndex coverage: " + json.dumps(coverage.get("by_file", {})) if coverage else ""

    # Dedup note
    dedup_note = ""
    finalized = []
    if session_id and isinstance(state, dict):
        finalized = list(set((state.get("finalized_ideas") or [])))
        if finalized:
            dedup_note = "\n\nAvoid these fingerprints (already finalized):\n- " + "\n- ".join(finalized)

    user = f"Topic: {topic}\nApplied filters: trip={trip or 'any'}, persona={persona or 'both'}{dedup_note}\n\nRetrieved context (annotated):\n{context}{coverage_note}\n\nInstructions:\n{system_outline}\n\nNote: After you output the outline, ask the user to confirm finalization for Step 2 (EDL)."

    # Productive system guard when presence is verified
    if "presence:" in context.lower() and "Missing" not in context:
        guard = (
            "System:\n"
            "You generate grounded Idea Cards and Storylines using the retrieved context.\n"
            "- Preserve Hinglish and code-mixed phrases.\n"
            "- Prefer videos; photos only as micro-bursts (near 0%, never >10%).\n"
            "- If unsure, ask 1–2 clarifying questions; do not return 'Nothing'.\n"
            "Status: Proceed. All required sources are loaded."
        )

    # History
    if session_id and append_history:
        try:
            append_history(session_id, "outline", "system", guard)
            append_history(session_id, "outline", "user", user)
        except Exception:
            pass

    out = chat_complete(guard, user, model=args.model, temperature=args.temperature)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "01a_ideation_outline.md").write_text(out, encoding="utf-8")
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime
    ts_initial = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (INITIAL_DIR / f"outline_{ts_initial}.md").write_text(out, encoding="utf-8")

    # Session artifact + fingerprint
    if session_id:
        try:
            p = persist_artifact(session_id, "outline", "01a_ideation_outline.md", out)
            import re
            m = re.search(r"Title\s*\(.*?\)\s*:\s*(.*)\n.*?Idea Summary\s*\n-\s*(.*)", out, flags=re.S|re.I)
            idea_key = (m.group(1) + " | " + m.group(2)) if m else out[:400]
            fp = compute_idea_fingerprint(idea_key)
            state.setdefault("candidates", []).append({"ts": ts_initial, "file": str(p), "fp": fp})
            if save_state:
                save_state(session_id, state)
        except Exception:
            pass

    # Snapshot debug
    from datetime import datetime as _dt
    ts = _dt.utcnow().strftime("%Y%m%dT%H%M%SZ")
    run_dir = RUNS_DIR / ts
    try:
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "DEBUG_outline_prompt.txt").write_text("SYSTEM:\n" + guard + "\n\nUSER:\n" + user, encoding="utf-8")
        (run_dir / "01a_ideation_outline.md").write_text(out, encoding="utf-8")
    except Exception:
        pass
    print("Wrote out/01a_ideation_outline.md and run snapshot")


def stage_edl_from_outline(args: argparse.Namespace) -> None:
    # Load outline
    outline_path = Path(args.outline) if args.outline else (OUT_DIR / "01a_ideation_outline.md")
    outline_text = read_text(outline_path)
    if not outline_text:
        raise SystemExit("No outline provided. Run 'outline' stage first or pass --outline <path>.")

    # Session
    session_id = getattr(args, "session_id", None)
    if session_id:
        try:
            from scripts.session_utils import append_history, persist_artifact  # type: ignore
        except Exception:
            from session_utils import append_history, persist_artifact  # type: ignore
    else:
        append_history = None  # type: ignore

    guard = load_prompt("00_ingest_guardrail.md", fallback="You are a careful, helpful assistant.")
    system_edl = load_prompt("01b_edl_from_outline.md", fallback=(
        "Generate the full EDL from the finalized outline. Prefer videos, avoid low-quality footage."
    ))

    # Basic retrieval for clip selection context
    topic = args.topic or "Travel reel EDL from outline"
    trip = args.trip
    persona = args.persona
    context = retrieve_context(topic, top_k=args.top_k, trip=trip, persona=persona)

    # Productive guard
    if "presence:" in context.lower() and "Missing" not in context:
        guard = (
            "System:\n"
            "You generate a detailed EDL from the given outline using retrieved clips only.\n"
            "- Prefer videos; photos only as micro-bursts (near 0%, never >10%).\n"
            "- Rank by quality cues; avoid blurry/shaky/noisy.\n"
            "- If a planned shot lacks a viable clip, propose nearest alternative and mark it.\n"
            "Status: Proceed. All required sources are loaded."
        )

    user = f"Finalized outline:\n\n{outline_text}\n\nRetrieved context (annotated):\n{context}\n\nInstructions:\n{system_edl}"

    if session_id and append_history:
        try:
            append_history(session_id, "edl", "system", guard)
            append_history(session_id, "edl", "user", user)
        except Exception:
            pass

    out = chat_complete(guard, user, model=args.model, temperature=args.temperature)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "01b_edl_from_outline.md").write_text(out, encoding="utf-8")
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime
    ts_initial = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (INITIAL_DIR / f"edl_{ts_initial}.md").write_text(out, encoding="utf-8")

    if session_id:
        try:
            persist_artifact(session_id, "edl", "01b_edl_from_outline.md", out)
        except Exception:
            pass

    # Snapshot debug
    from datetime import datetime as _dt
    ts = _dt.utcnow().strftime("%Y%m%dT%H%M%SZ")
    run_dir = RUNS_DIR / ts
    try:
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "DEBUG_edl_prompt.txt").write_text("SYSTEM:\n" + guard + "\n\nUSER:\n" + user, encoding="utf-8")
        (run_dir / "01b_edl_from_outline.md").write_text(out, encoding="utf-8")
    except Exception:
        pass
    print("Wrote out/01b_edl_from_outline.md and run snapshot")


def stage_script(args: argparse.Namespace) -> None:
    """Generate Vipin-style Hinglish script aligned to finalized outline/EDL."""
    system = load_prompt("02_script_vipinclaude.md", fallback=(
        "Write a concise Hinglish script aligned to the provided outline/EDL."
    ))

    # Load inputs: prefer explicit paths; fallback to latest outputs
    idea_text = read_text(Path(args.idea)) if getattr(args, "idea", None) else ""
    outline_text = read_text(Path(args.outline)) if getattr(args, "outline", None) else ""
    edl_text = read_text(Path(args.edl)) if getattr(args, "edl", None) else ""
    if not outline_text:
        outline_text = read_text(OUT_DIR / "01a_ideation_outline.md")
    if not edl_text:
        edl_text = read_text(OUT_DIR / "01b_edl_from_outline.md")
    if not idea_text:
        # Fall back to single-pass ideation which may include an EDL
        idea_text = read_text(OUT_DIR / "01_ideation_and_edl.md")

    # Preferences hint
    pref_path = ROOT / "data" / "feedback" / "preferences.json"
    pref_hint = ""
    try:
        if pref_path.exists():
            pref = json.loads(pref_path.read_text(encoding="utf-8"))
            # Keep concise to reduce tokens
            pref_hint = "\n\nUser Preference Hints:" \
                        f"\n- Hook types: {list((pref.get('hook_types') or {}).keys())[:5]}" \
                        f"\n- Media pref: {pref.get('media_type_pref')}" \
                        f"\n- Duration pref: {pref.get('duration_pref')}" \
                        f"\n- Do/Do-not tags: {pref.get('tags')}"
    except Exception:
        pass

    # Retrieval context to supply persona doc + narrations for grounding
    topic = args.topic or "Script generation from finalized outline/EDL"
    trip = args.trip
    persona = args.persona
    context = retrieve_context(topic, top_k=args.top_k, trip=trip, persona=persona)

    # Productive guard
    guard = load_prompt("00_ingest_guardrail.md", fallback="You are a careful, helpful assistant.")
    if "presence:" in context.lower() and "Missing" not in context:
        guard = (
            "System:\n"
            "You generate Vipin-style Hinglish scripts grounded to the provided outline/EDL and retrieved context.\n"
            "- Align beats to EDL when available; otherwise mark placeholders that need EDL confirmation.\n"
            "- Preserve Hinglish and code-mixed phrases.\n"
            "- Keep outputs deterministic at low temperature.\n"
            "Status: Proceed. All required sources are loaded."
        )

    # Build user message
    pieces = []
    if idea_text:
        pieces.append("Provided Idea/Outline (if any):\n" + idea_text)
    if outline_text:
        pieces.append("Finalized Outline (Step 1):\n" + outline_text)
    if edl_text:
        pieces.append("Finalized EDL (Step 2):\n" + edl_text)
    pieces.append("Retrieved context (annotated):\n" + context)
    user = "\n\n---\n".join([p for p in pieces if p]) + pref_hint + "\n\nInstructions:\n" + system

    # Session history + artifacts
    session_id = getattr(args, "session_id", None)
    if session_id:
        try:
            from scripts.session_utils import append_history, persist_artifact  # type: ignore
        except Exception:
            from session_utils import append_history, persist_artifact  # type: ignore
        try:
            append_history(session_id, "script", "system", guard)
            append_history(session_id, "script", "user", user)
        except Exception:
            pass
    else:
        persist_artifact = None  # type: ignore

    out = chat_complete(guard, user, model=args.model, temperature=args.temperature)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "02_script_vipinclaude.md").write_text(out, encoding="utf-8")
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (INITIAL_DIR / f"script_{ts}.md").write_text(out, encoding="utf-8")

    if session_id and persist_artifact:
        try:
            persist_artifact(session_id, "script", "02_script_vipinclaude.md", out)
        except Exception:
            pass

    # Snapshot debug
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts).mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts / "DEBUG_script_prompt.txt").write_text(
        "SYSTEM:\n" + guard + "\n\nUSER:\n" + user,
        encoding="utf-8",
    )
    (RUNS_DIR / ts / "02_script_vipinclaude.md").write_text(out, encoding="utf-8")
    print("Wrote out/02_script_vipinclaude.md and run snapshot")


def stage_suno(args: argparse.Namespace) -> None:
    system = load_prompt("03_suno_prompt.md", fallback=(
        "You craft concise music generation prompts (genre, mood, tempo, instruments) for SUNO based on a video script. "
        "Return only the prompt, no explanations."
    ))
    script_text = read_text(Path(args.script)) if args.script else ""
    if not script_text:
        try:
            script_text = read_text(OUT_DIR / "01_ideation_and_edl.md")
        except Exception:
            pass
    if not script_text:
        raise SystemExit("No script provided and no prior output found.")
    # preferences hint reuse
    pref_path = ROOT / "data" / "feedback" / "preferences.json"
    pref_hint = ""
    try:
        if pref_path.exists():
            pref = json.loads(pref_path.read_text(encoding="utf-8"))
            pref_hint = "\n\nUser Preference Hints:" \
                        f"\n- Media preference: {pref.get('media_type_pref')}" \
                        f"\n- Duration pref: {pref.get('duration_pref')}"
    except Exception:
        pass
    user = f"Video script / summary:\n{script_text}\n\nCreate a SUNO prompt.{pref_hint}"
    out = chat_complete(system, user, model=args.model, temperature=args.temperature)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (OUT_DIR / "03_suno_prompt.txt").write_text(out, encoding="utf-8")
    (INITIAL_DIR / f"suno_{ts}.txt").write_text(out, encoding="utf-8")
    # snapshot debug
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts).mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts / "DEBUG_suno_prompt.txt").write_text(
        "SYSTEM:\n" + system + "\n\nUSER:\n" + user,
        encoding="utf-8",
    )
    (RUNS_DIR / ts / "03_suno_prompt.txt").write_text(out, encoding="utf-8")
    print("Wrote out/03_suno_prompt.txt and run snapshot")


def stage_handoff(args: argparse.Namespace) -> None:
    system = load_prompt("04_editor_handoff.md", fallback=(
        "Produce a clear editor handoff: summary, asset list, EDL with timestamps, and notes."
    ))
    pieces: List[str] = []
    for p in [args.idea, args.script, args.edl, args.suno]:
        if p:
            txt = read_text(Path(p))
            if txt:
                pieces.append(txt)
    # fallbacks to prior outputs
    if not pieces:
        for fn in ["01_ideation_and_edl.md", "03_suno_prompt.txt"]:
            fp = OUT_DIR / fn
            if fp.exists():
                pieces.append(read_text(fp))
    if not pieces:
        raise SystemExit("No inputs found. Provide --idea/--script/--edl/--suno or run ideation first.")
    # preferences hint reuse
    pref_path = ROOT / "data" / "feedback" / "preferences.json"
    pref_hint = ""
    try:
        if pref_path.exists():
            pref = json.loads(pref_path.read_text(encoding="utf-8"))
            pref_hint = "\n\nUser Preference Hints:" \
                        f"\n- Cuts/30s mean: {(pref.get('cuts_per_30s') or {}).get('mean')}" \
                        f"\n- Duration pref: {pref.get('duration_pref')}"
    except Exception:
        pass
    user = "\n\n---\n".join(pieces) + pref_hint
    out = chat_complete(system, user, model=args.model, temperature=args.temperature)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    INITIAL_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    (OUT_DIR / "04_editor_handoff.md").write_text(out, encoding="utf-8")
    (INITIAL_DIR / f"handoff_{ts}.md").write_text(out, encoding="utf-8")
    # snapshot debug
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts).mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / ts / "DEBUG_handoff_prompt.txt").write_text(
        "SYSTEM:\n" + system + "\n\nUSER:\n" + user,
        encoding="utf-8",
    )
    (RUNS_DIR / ts / "04_editor_handoff.md").write_text(out, encoding="utf-8")
    print("Wrote out/04_editor_handoff.md and run snapshot")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Run pipeline without Flowise.")
    p.add_argument("stage", choices=["ideation", "outline", "edl_from_outline", "script", "suno", "handoff"], help="Stage to run")
    p.add_argument("--topic", help="Topic for ideation stage (default: Vietnam travel reels)")
    p.add_argument("--trip", help="Restrict retrieval by trip keyword (e.g., vietnam, maldives, ladakh)")
    p.add_argument("--persona", help="Restrict by persona (e.g., Vipin, Divya)")
    p.add_argument("--prompt", help="Override prompt file for outline stage (path to .md)")
    p.add_argument("--script", help="Path to script text for suno stage")
    p.add_argument("--outline", help="Path to finalized outline for EDL/Script stages")
    p.add_argument("--idea", help="Path to idea card text for handoff stage")
    p.add_argument("--edl", help="Path to EDL text for EDL/Script/Handoff stages")
    p.add_argument("--suno", help="Path to suno prompt text for handoff stage")
    p.add_argument("--top-k", type=int, default=8, help="Top K chunks to retrieve from Qdrant")
    p.add_argument("--model", default=os.getenv("OPENAI_CHAT_MODEL", "gpt-5-mini"))
    p.add_argument("--temperature", type=float, default=0.4)
    p.add_argument("--session-id", help="Session identifier for chat-like memory and dedup")
    return p


def main(argv: List[str]) -> int:
    args = build_parser().parse_args(argv)
    if args.stage == "ideation":
        stage_ideation(args)
    elif args.stage == "outline":
        stage_outline(args)
    elif args.stage == "edl_from_outline":
        stage_edl_from_outline(args)
    elif args.stage == "script":
        stage_script(args)
    elif args.stage == "suno":
        stage_suno(args)
    elif args.stage == "handoff":
        stage_handoff(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
