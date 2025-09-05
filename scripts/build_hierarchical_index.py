import argparse
import os
import sys
import uuid
from dataclasses import dataclass
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


def iter_source_files(root: Path) -> Iterable[Path]:
    exts = {".md", ".mdx", ".txt"}
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
        content = read_text(file)
        parts = hierarchical_chunks(
            content,
            max_tokens_per_chunk=max_tokens,
            overlap_tokens=overlap_tokens,
        )
        for idx, txt in enumerate(parts):
            chunks.append(
                DocChunk(file_path=str(file.as_posix()), chunk_index=idx, text=txt)
            )
    return chunks


def embed_texts(client: OpenAI, model: str, texts: List[str]) -> List[List[float]]:
    # Batch for efficiency
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
        payloads.append(
            {
                "file_path": ch.file_path,
                "chunk_index": ch.chunk_index,
                "text": ch.text,
                "n_tokens": count_tokens(ch.text),
            }
        )
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

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("OPENAI_API_KEY is required", file=sys.stderr)
        sys.exit(1)

    # Prepare
    client = OpenAI(api_key=openai_api_key)
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


if __name__ == "__main__":
    main()
