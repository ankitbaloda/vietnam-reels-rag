import argparse
import os
import sys
import uuid
import csv
import json
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from qdrant_client import QdrantClient, models
from openai import OpenAI
import tiktoken

# Try both absolute and relative import for flexibility
try:
    from scripts.chunk_utils import hierarchical_chunks, count_tokens  # type: ignore
except Exception:
    try:
        from chunk_utils import hierarchical_chunks, count_tokens  # type: ignore
    except Exception as e:
        print("Failed to import chunk_utils:", e, file=sys.stderr)
        raise


MODEL_DIMS: Dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}


def infer_dim(model: str) -> int:
    if model in MODEL_DIMS:
        return MODEL_DIMS[model]
    # Fallback: assume 1536
    return 1536


@dataclass
class DocChunk:
    file_path: str
    chunk_index: int
    text: str
    metadata: Dict[str, str] = field(default_factory=dict)


def iter_source_files(root: Path) -> Iterable[Path]:
    exts = {".md", ".mdx", ".txt", ".csv"}
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts:
            yield p


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        # Fallback attempt
        return path.read_text(errors="ignore")


def build_chunks(source_dir: Path, max_tokens: int, overlap_tokens: int) -> List[DocChunk]:
    chunks: List[DocChunk] = []
    for file in iter_source_files(source_dir):
        if file.suffix.lower() == ".csv":
            # One chunk per row for better grounding and precise referencing
            try:
                with file.open("r", encoding="utf-8", newline="") as f:
                    reader = csv.DictReader(f)
                    for r_idx, row in enumerate(reader):
                        # Flatten row into a compact textual record
                        fields = [f"{k}={str(v).strip()}" for k, v in row.items()]
                        text = f"CSV_ROW | source={file.name} | " + " | ".join(fields)
                        # Also carry row fields into payload with a row_ prefix for future filters (trip/persona/location, etc.)
                        md = {f"row_{k}": str(v).strip() for k, v in row.items()}
                        chunks.append(DocChunk(file_path=str(file.as_posix()), chunk_index=r_idx, text=text, metadata=md))
            except Exception:
                # Fallback to plain text if CSV parsing fails
                content = read_text(file)
                for idx, txt in enumerate(
                    hierarchical_chunks(content, max_tokens_per_chunk=max_tokens, overlap_tokens=overlap_tokens)
                ):
                    chunks.append(DocChunk(file_path=str(file.as_posix()), chunk_index=idx, text=txt))
        else:
            content = read_text(file)
            parts = hierarchical_chunks(
                content,
                max_tokens_per_chunk=max_tokens,
                overlap_tokens=overlap_tokens,
            )
            for idx, txt in enumerate(parts):
                chunks.append(DocChunk(file_path=str(file.as_posix()), chunk_index=idx, text=txt))
    return chunks


def embed_texts(client: OpenAI, model: str, texts: List[str]) -> List[List[float]]:
    # Batch for efficiency
    # If routing via OpenRouter, ensure OpenAI models are namespaced
    if os.getenv("OPENROUTER_API_KEY") and "/" not in model and model.startswith("text-embedding"):
        model = f"openai/{model}"
    resp = client.embeddings.create(model=model, input=texts)
    return [d.embedding for d in resp.data]


def ensure_collection(qc: QdrantClient, name: str, vector_size: int):
    try:
        _ = qc.get_collection(name)
        return
    except Exception:
        pass
    qc.create_collection(
        collection_name=name,
        vectors_config=models.VectorParams(
            size=vector_size,
            distance=models.Distance.COSINE,
        ),
    )


def upsert_chunks(
    qc: QdrantClient,
    collection: str,
    vectors: List[List[float]],
    chunks: List[DocChunk],
):
    ids: List[str] = []
    payloads: List[Dict] = []
    for ch in chunks:
        ids.append(str(uuid.uuid5(uuid.NAMESPACE_URL, f"{ch.file_path}:{ch.chunk_index}")))
        base = {
            "file_path": ch.file_path,
            "source_name": Path(ch.file_path).name,
            "source_type": Path(ch.file_path).suffix.lower().lstrip('.'),
            "chunk_index": ch.chunk_index,
            "text": ch.text,
            "n_tokens": count_tokens(ch.text),
        }
        # Merge CSV row metadata if present
        if ch.metadata:
            base.update(ch.metadata)
        payloads.append(base)
    qc.upsert(
        collection_name=collection,
        points=models.Batch(ids=ids, vectors=vectors, payloads=payloads),
        wait=True,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Build hierarchical embeddings index into Qdrant"
    )
    parser.add_argument("--source-dir", default=os.getenv("SOURCE_DIR", "data/source"))
    parser.add_argument(
        "--collection", default=os.getenv("QDRANT_COLLECTION", "flowise_reels")
    )
    parser.add_argument(
        "--embeddings-model",
        default=os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-large"),
    )
    parser.add_argument(
        "--qdrant-url", default=os.getenv("QDRANT_URL", "http://localhost:6333")
    )
    parser.add_argument("--qdrant-api-key", default=os.getenv("QDRANT_API_KEY"))
    parser.add_argument(
        "--max-tokens-per-chunk",
        type=int,
        default=int(os.getenv("MAX_TOKENS_PER_CHUNK", "800")),
    )
    parser.add_argument(
        "--overlap-tokens",
        type=int,
        default=int(os.getenv("OVERLAP_TOKENS", "100")),
    )
    args = parser.parse_args()

    # Load .env if present
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv()
    except Exception:
        pass

    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        print(f"Source directory not found: {source_dir}", file=sys.stderr)
        sys.exit(1)

    # Prepare OpenAI/OpenRouter client
    def _sanitize(key: str) -> str:
        key = key.strip()
        return "".join(ch for ch in key if 32 <= ord(ch) < 127)

    or_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if or_key:
        base_url = (os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").strip()
        headers = {}
        site = os.getenv("OPENROUTER_SITE_URL")
        app = os.getenv("OPENROUTER_APP_NAME")
        if site:
            headers["HTTP-Referer"] = site
        if app:
            headers["X-Title"] = app
        client = OpenAI(base_url=base_url, api_key=_sanitize(or_key), default_headers=headers or None)
    else:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            print("Set OPENROUTER_API_KEY or OPENAI_API_KEY in environment", file=sys.stderr)
            sys.exit(1)
        client = OpenAI(api_key=_sanitize(openai_api_key))
    qc = QdrantClient(url=args.qdrant_url, api_key=args.qdrant_api_key)

    dim = infer_dim(args.embeddings_model)
    ensure_collection(qc, args.collection, vector_size=dim)

    # Build chunks
    all_chunks = build_chunks(
        source_dir, max_tokens=args.max_tokens_per_chunk, overlap_tokens=args.overlap_tokens
    )
    if not all_chunks:
        print("No content found to index.")
        return

    # Embed and upsert in batches
    BATCH = 64
    for i in range(0, len(all_chunks), BATCH):
        batch = all_chunks[i : i + BATCH]
        vectors = embed_texts(client, args.embeddings_model, [c.text for c in batch])
        upsert_chunks(qc, args.collection, vectors, batch)
        print(f"Upserted {i + len(batch)}/{len(all_chunks)} chunks")

    # Emit a simple coverage report
    by_file: Dict[str, int] = defaultdict(int)
    for ch in all_chunks:
        by_file[ch.file_path] += 1
    report = {
        "collection": args.collection,
        "total_chunks": len(all_chunks),
        "by_file": dict(by_file),
    }
    out_dir = Path("out")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote coverage report to {out_dir / 'index_report.json'}")


if __name__ == "__main__":
    main()
