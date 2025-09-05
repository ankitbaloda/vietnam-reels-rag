# Flowise + Qdrant setup and hierarchical indexing

This repository includes a docker-compose for running Flowise and Qdrant locally, plus a simple hierarchical indexer (paragraph -> sentence windows) that writes embeddings to Qdrant.

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local indexing)
- An OpenAI API key

## Quick start (Docker)

1. Copy the environment example and set your keys.
   ```bash
   cp .env.example .env
   # Edit .env to add OPENAI_API_KEY and (optionally) QDRANT_API_KEY
   ```
2. Start the stack:
   ```bash
   docker compose up -d
   ```
3. Open Flowise at http://localhost:3000.
   - Default credentials (as configured in docker-compose.yml): `admin` / `admin`
4. In your Flow, configure the Vector Store connection to Qdrant using the internal Docker address:
   - Qdrant URL: `http://qdrant:6333`
   - Qdrant API Key: leave empty (for local) or set if you run a secured Qdrant

Your local project folders mapped into the container:
- `./flows` -> `/app/flows`
- `./data/source` -> `/app/data/source`
- `./prompts` -> `/app/flows_prompts`

## Prepare source data

Place your `.md` / `.txt` files under `data/source/`. Commit small test files to the repo if you want CI to index them.

## Build the hierarchical index (locally)

You can run the indexer against your local Qdrant:

```bash
python -m venv .venv && source .venv/bin/activate
pip install qdrant-client tiktoken openai python-dotenv
python scripts/build_hierarchical_index.py \
  --source-dir data/source \
  --collection flowise_reels \
  --embeddings-model text-embedding-3-large \
  --qdrant-url http://localhost:6333 \
  --max-tokens-per-chunk 800 \
  --overlap-tokens 100
```

Required env:
- `OPENAI_API_KEY` must be set in your shell (`export OPENAI_API_KEY=...`).

## Build the hierarchical index (GitHub Actions)

A reusable workflow is included: `.github/workflows/reindex.yml`.

1. Add your secrets in the repository settings:
   - `OPENAI_API_KEY` (required)
   - `QDRANT_API_KEY` (optional; not needed when using the provided Qdrant service in CI)
2. Trigger the workflow manually:
   - GitHub UI -> Actions -> "Reindex Hierarchical Embeddings" -> Run workflow.
   - Parameters:
     - `collection_name`: defaults to `flowise_reels`
     - `source_dir`: defaults to `data/source`
     - `embeddings_model`: default `text-embedding-3-large`
     - `max_tokens_per_chunk`: default `800`
     - `overlap_tokens`: default `100`

On every push to `data/source/**` or `scripts/**`, the workflow will also run with default values.

## Notes

- The chunker uses a lightweight paragraph -> sentence window strategy via `scripts/chunk_utils.py` and counts tokens with `tiktoken`.
- The indexer uses OpenAI embeddings and writes to Qdrant. Adjust the collection name and model as you prefer.
- If you switch the embeddings model, ensure the vector dimension matches (the script contains a small mapping for common models).