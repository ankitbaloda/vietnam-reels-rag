#!/usr/bin/env python3
"""
Simple web fetch helper for this workspace.

Use cases:
- Quickly pull docs/API responses/pages into the repo so Copilot can read/summarize them.

Examples:
  python3 scripts/fetch_url.py https://openrouter.ai/api/v1/models
  python3 scripts/fetch_url.py https://qdrant.tech/documentation/ -n qdrant_docs
  python3 scripts/fetch_url.py https://httpbin.org/json -o data/web/httpbin.json

Outputs:
- Saves content under data/web/ by default, with a slug file name.
- Also writes a sidecar metadata JSON (.meta.json) with URL, timestamp, content-type, and sha256.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import pathlib
import re
import sys
from datetime import datetime, timezone

import httpx


DEFAULT_DIR = pathlib.Path("data/web")


def slugify(url: str) -> str:
    # Keep domain + path segments alnum-hyphen, drop query
    url_no_scheme = re.sub(r"^https?://", "", url.strip())
    url_no_query = url_no_scheme.split("?", 1)[0]
    parts = re.split(r"[/#]+", url_no_query)
    cleaned_parts = [re.sub(r"[^a-zA-Z0-9._-]", "-", p).strip("-_") for p in parts if p]
    base = "__".join(cleaned_parts) or "download"
    # trim to reasonable length
    return base[:200]


def guess_extension(content_type: str | None, url: str) -> str:
    if not content_type:
        # fall back to URL extension
        ext = pathlib.Path(url.split("?", 1)[0]).suffix
        return ext or ".html"
    ct = content_type.split(";")[0].strip().lower()
    if ct in {"application/json", "text/json"}:
        return ".json"
    if ct in {"text/html", "application/xhtml+xml"}:
        return ".html"
    if ct in {"text/plain"}:
        return ".txt"
    # try mimetypes
    ext = mimetypes.guess_extension(ct) or ""
    return ext or ".bin"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ensure_dir(p: pathlib.Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def save_file(path: pathlib.Path, content: bytes) -> None:
    ensure_dir(path.parent)
    with open(path, "wb") as f:
        f.write(content)


def save_meta(path: pathlib.Path, meta: dict) -> None:
    meta_path = path.with_suffix(path.suffix + ".meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def fetch(url: str, timeout: float = 30.0, headers: dict | None = None) -> tuple[int, bytes, str | None]:
    hdrs = {
        "User-Agent": "vietnam-reels-rag-fetch/1.0 (+https://github.com/ankitbaloda)",
        "Accept": "*/*",
    }
    if headers:
        hdrs.update(headers)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        r = client.get(url, headers=hdrs)
        ct = r.headers.get("content-type")
        return r.status_code, r.content, ct


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Fetch a URL and save to data/web/")
    ap.add_argument("url", help="URL to fetch")
    ap.add_argument("--out", "-o", help="Output file path (relative to repo). If omitted, derive from URL.")
    ap.add_argument("--name", "-n", help="Base filename (without extension); used only if --out is not given.")
    ap.add_argument("--dir", default=str(DEFAULT_DIR), help="Output directory when --out is not set (default: data/web)")
    ap.add_argument("--timeout", type=float, default=30.0, help="Request timeout in seconds (default: 30)")
    args = ap.parse_args(argv)

    url = args.url
    status, content, content_type = fetch(url, timeout=args.timeout)
    ts = datetime.now(timezone.utc).isoformat()

    if args.out:
        out_path = pathlib.Path(args.out)
    else:
        base = args.name or slugify(url)
        ext = guess_extension(content_type, url)
        out_dir = pathlib.Path(args.dir)
        out_path = out_dir / f"{base}{ext}"

    meta = {
        "url": url,
        "saved_at": ts,
        "status": status,
        "content_type": content_type,
        "path": str(out_path),
        "sha256": sha256_bytes(content),
    }

    save_file(out_path, content)
    save_meta(out_path, meta)

    print(json.dumps(meta, indent=2))
    if status >= 400:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
