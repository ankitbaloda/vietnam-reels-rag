import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional

ROOT = Path(__file__).resolve().parents[1]
SESSIONS = ROOT / "out" / "sessions"


def _now_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def get_session_dirs(session_id: str, stage: Optional[str] = None) -> Dict[str, Path]:
    base = SESSIONS / session_id
    stage_dir = base / (stage or "") if stage else None
    paths = {
        "base": base,
        "stage": stage_dir if stage_dir else base,
        "history": (stage_dir / "history.jsonl") if stage_dir else (base / "history.jsonl"),
        "state": base / "state.json",
        "artifacts": (stage_dir / "artifacts") if stage_dir else (base / "artifacts"),
        "final": base / "final",
    }
    # ensure dirs
    paths["base"].mkdir(parents=True, exist_ok=True)
    if stage_dir:
        stage_dir.mkdir(parents=True, exist_ok=True)
        paths["artifacts"].mkdir(parents=True, exist_ok=True)
    paths["final"].mkdir(parents=True, exist_ok=True)
    return paths


def append_history(session_id: str, stage: str, role: str, content: str, meta: Optional[Dict[str, Any]] = None) -> None:
    d = get_session_dirs(session_id, stage)
    rec = {
        "ts": _now_ts(),
        "role": role,
        "stage": stage,
        "content": content,
        "meta": meta or {},
    }
    with d["history"].open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def load_state(session_id: str) -> Dict[str, Any]:
    d = get_session_dirs(session_id)
    if d["state"].exists():
        try:
            return json.loads(d["state"].read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_state(session_id: str, state: Dict[str, Any]) -> None:
    d = get_session_dirs(session_id)
    d["state"].write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def compute_idea_fingerprint(text: str) -> str:
    # Normalize lightly: lowercase, strip spaces
    norm = " ".join((text or "").lower().split())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:16]


def persist_artifact(session_id: str, stage: str, filename: str, content: str) -> Path:
    d = get_session_dirs(session_id, stage)
    ts = _now_ts()
    p = d["artifacts"] / f"{stage}_{ts}{Path(filename).suffix or '.md'}"
    p.write_text(content, encoding="utf-8")
    return p
