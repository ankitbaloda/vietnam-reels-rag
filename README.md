# Travel Reels RAG — grounded, self‑learning, multi‑model pipeline (multi‑trip)

This system is a general RAG pipeline to ideate and produce daily short‑form travel videos (Instagram Reels, YouTube Shorts) across all your trips. Vietnam is just the first dataset; you’ll keep updating the sources folder as you travel more. Outputs are grounded strictly in your own footage and docs, and the assistant learns your style over time.

Core grounded sources (live today; extend per trip):
1) Travel Files Directory.csv — master rows of your actual clips/photos with enriched fields (e.g., enrichment_raw/story_description, location, time_of_day, people)
2) Master_Viral_Travel_Reels_Playbook.txt — your distilled viral frameworks from Indian travel creators (hooks, pacing, cuts/30s, structure)
3) Vietnam Daywise Narrations Transcripts.txt — day‑by‑day trip narration (more trips coming as you add them)
4) vietnam_trip_costs - Trip Cost (Audience).csv — budget breakdown (useful for proofs/overlays)
5) VIPIN CHAHAL - COMPLETE STYLE DOCUMENTATION.txt — tone, speaking, and creative style (extend with personality questionnaires if needed)

Note: The system is trip‑agnostic. Add new trips by dropping corresponding files into `data/source/` (or updating existing ones) and re‑indexing. The Travel Files Directory will grow beyond Vietnam over time.

Core stack:
- Qdrant (vector DB) + hierarchical chunking with CSV row payloads
- FastAPI backend (OpenRouter first; OpenAI fallback) with RAG endpoints
- Flowise (optional no‑code flows)
- Next.js web UI (model picker, RAG toggle)

Run locally (Docker Desktop) or in GitHub Codespaces.

--------------------------------------------------------------------------------

End‑to‑end flow (per reel)

Step 1: Ideation (two ways) → Outline (01a)
- Two entry modes:
	1) “Generate N ideas” from all grounded sources for a trip/persona.
	2) “Seed idea” you provide; system solidifies it into the framework.
- Required reasoning before proposing: the assistant analyses…
	- Travel Files Directory enrichment (use `enrichment_raw`/story_description to understand available clip types, locations, quality cues)
	- Playbook (frame into a proven viral structure; hook types; pacing; cuts/30s)
	- Day‑wise narrations (build a realistic storyline aligned to your actual travel days)
	- Trip costs (inject proof/overlays when relevant)
- Output: an Idea Card that includes:
	- Title + concise “Idea Summary”
	- Storyline as mini‑chapters covering the whole trip/diverse highlights
	- For each chapter: number of shots to allocate, shot intents, and what clip types exist to support it
	- Total shots divided across chapters (targeting Playbook density). Photos only as quick micro‑bursts (~0–10% max).
- Returns human text + mirrored JSON; asks you to finalize the outline.

Step 2: EDL from Outline (01b)
- Output: Full EDL with one best real clip per shot (filename, clip_id, exact story_description from `enrichment_raw`/row), plus Shot Math (durations, cuts/30s).
- Strictly grounded in your captured footage; ranks better clips (stable/gimbal, joyful, clean audio) and avoids blurry/shaky/noisy.
- Iterative: you can ask for swaps/refinements; final EDL becomes the editor’s checklist.

Step 3: Script (Vipin Hinglish)
- Ingests finalized outline/EDL + persona + style doc + day‑wise/narrations + (optionally) costs.
- Produces a Hinglish VO script aligned to the EDL beats and timings; persona can be Vipin, Divya, or both.
- Delivers two SSML versions conforming to 11Labs docs for TTS.

Step 4: Music prompts (optional)
- If needed, generate a concise SUNO prompt based on the script and voice‑over duration (mood, tempo, genre, instrumentation).
- Often you can skip this and use a saved/trending IG audio instead.

--------------------------------------------------------------------------------

Self‑learning loop

- Auto‑save per stage: out/runs/<ts>/ and out/initial/
- Finalize: `scripts/finalize_output.py` saves to out/final/ and runs `compare_outputs.py` for diffs (sentence/word‑level + language shifts + EDL clip swaps).
- Aggregate: `scripts/summarize_feedback.py` -> data/feedback/preferences.json (hooks, pacing, durations, media mix)
- Next runs inject preference hints and avoid repeating finalized fingerprints per session.

Sessions & memory
- out/sessions/<sessionId>/ with stage histories (history.jsonl), artifacts/, and state.json (finalized fingerprints, preferences).
- Dedup: ideation/outline avoid ideas similar to previously finalized in the same session.

--------------------------------------------------------------------------------

Data grounding and retrieval

- Qdrant stores hierarchical chunks; CSV rows are flattened to text and mirrored as payload fields (row_*), enabling simple filters (trip/persona) if needed.
- Retrieval is used by the pipeline and `/api/rag/chat` for grounded answers with citations.
- Guardrail (`prompts/00_ingest_guardrail.md`) enforces presence of the four required sources; no hallucination.

--------------------------------------------------------------------------------

Run options

Docker Compose (recommended)
- `docker compose up -d`
- Services: Qdrant (6333), FastAPI server (8000), Web UI (3001), Flowise (3000; optional), indexer + pipeline examples.

CLI pipeline (two‑step outline → EDL)
- Step 1 Outline: `python3 scripts/run_pipeline.py outline --topic "<your brief>"`
- Step 2 EDL: `python3 scripts/run_pipeline.py edl_from_outline --outline out/01a_ideation_outline.md`
- Script: `python3 scripts/run_pipeline.py script`
- Music: `python3 scripts/run_pipeline.py suno`
- Handoff: `python3 scripts/run_pipeline.py handoff`

Notes:
- We do not force `max_tokens` in pipeline calls; providers pick sensible limits. Pass limits only if you want to constrain outputs.
- Use `--session-id` to enable memory/dedup per trip/persona.

Flowise (optional no‑code)
- Import flows from `flows/*.flowise.json` and point to Qdrant.

--------------------------------------------------------------------------------

Backend API (FastAPI)

- GET `/health` — service status
- GET `/models` — OpenRouter model list (fallback curated list with provider/cost/recommended flags)
- POST `/chat` — generic chat (OpenRouter /chat → /responses fallback; OpenAI fallback for supported models)
- POST `/rag/chat` — grounded chat with Qdrant retrieval, citations, and token controls
	- Supports optional `session_id` and `step` in body to persist per-step history

- GET `/history` — fetch saved chat history
	- Query params: `session_id` (required), `step` (optional), `limit` (default 200)
	- Returns `{ session_id, step?, messages: [{ role, content, model?, ts, step }] }`

Pipeline endpoints for UI integration (Bolt.new / any no‑code)
- POST `/pipeline/ideation` — single‑pass “01 Ideation + EDL” (returns `{status, out_dir, file, content}`)
- POST `/pipeline/outline` — Step 1 (Outline) (returns latest outline content)
- POST `/pipeline/edl` — Step 2 (EDL from outline) (returns latest EDL content)
- POST `/pipeline/script` — Step 3 (Script) (returns latest script content)
- POST `/pipeline/suno` — SUNO prompt generation (returns latest SUNO prompt)

Model routing & tokens
- OpenRouter first (supports OpenAI/Claude/Gemini via one API), OpenAI fallback for allowlisted chat models.
- We don’t force `max_tokens`; providers can choose. Temperature is handled conservatively for families that don’t support it.

--------------------------------------------------------------------------------

Web UI (Next.js)

- Chat layout with model picker
- Filters: Cost (Free/Paid), Provider (OpenAI/Anthropic/Google), Recommended group
- Toggle: Ground with files (RAG) → calls `/api/rag/chat` and shows Sources
- Markdown rendering and copy button; error banner includes provider info
- Rewrites `/api/*` to the FastAPI server

Quick access to the Web UI
- Local URL: http://localhost:3001/
- Live features: server‑sent streaming responses, Stop (Esc), queued sends, inline citations for RAG, Ctrl/Cmd+K search in the current conversation, theme toggle, inline title editing.

Bolt.new (optional, fast iteration)
- You can import this GitHub repo directly into bolt.new or open it via the GitHub integration.
- Required env vars (set in bolt): OPENROUTER_API_KEY or OPENAI_API_KEY; optionally QDRANT_URL (defaults to http://qdrant:6333) and EMBEDDINGS_MODEL.
- To run locally in bolt’s terminal:
	- Backend: uvicorn server.app:app --host 0.0.0.0 --port 8000
	- Web: cd web && npm install && npm run dev
	- Or use docker compose up -d (requires docker service)

Sessions & history (server)
- The API accepts `session_id` and optional `step` on `/chat`, `/rag/chat`, and all `/pipeline/*` routes.
- When provided, the server writes per-step messages to SQLite at `database.sqlite` (configurable via `SQLITE_PATH`).
- You can read back history via `GET /history?session_id=...&step=...`.

--------------------------------------------------------------------------------

Grounding + quality rules

- Video‑first; photos only for 1s micro‑bursts (aim ~0–10% max)
- Rank clips by positive cues (stable/gimbal, joyful, high ai_score, clear notes); avoid blurry/shaky/noisy
- Playbook pacing (shots/30s): hook burst → steady mid → payoff spike
- Persona adherence (Vipin/Divya); Hinglish; adherence to day‑wise narrations

Voice‑over (11Labs)
- After script finalization, generate 2 SSML variants (11Labs compatible) and synthesize VO via 11Labs API.
- SSML variants allow quick testing of pacing/pauses.

Editor handoff
- Package the finalized Idea Card, EDL, Script, VO/music decisions, and footage references into a clear handoff for the editor.
- See prompt `prompts/04_editor_handoff.md` and generated output `out/04_editor_handoff.md`.

Persona extensions
- If the style doc isn’t sufficient, add a Personality Questionnaire with answers (Vipin/Divya) to `data/source/` and re‑index. The assistant will incorporate that to better match tone/voice in future runs.

--------------------------------------------------------------------------------

Maintenance

- Update/add trip sources under `data/source/` and re‑index (`scripts/build_hierarchical_index.py` runs via compose’s `indexer` service or locally). This system is not Vietnam‑only; it scales across trips.
- Export Flowise flows after tweaks and commit to `flows/`
- Finalize good outputs to train preferences and dedup future ideas
- Keep API keys in `.env`; never commit secrets

--------------------------------------------------------------------------------

Data locations (persistence)

- Vector index: Qdrant volume `qdrant_storage` (Docker) holds embeddings and payloads.
- App database: `database.sqlite` at repo root stores per-session, per-step chat history (can be moved by setting `SQLITE_PATH`).
- Pipeline artifacts & sessions: written under `out/`:
	- `out/01a_ideation_outline.md`, `out/01b_edl_from_outline.md`, `out/02_script_vipinclaude.md`, `out/03_suno_prompt.txt`, etc.
	- `out/sessions/<sessionId>/stage/` with `history.jsonl`, `artifacts/`, and `state.json` (CLI pipeline utilities).
- Source data: `data/source/` (Playbook, Daywise, Costs, Travel Files, Style docs); extend per trip.
- UI finals: stored in browser `localStorage` by default; can be mirrored to server with a small endpoint if needed.

License: MIT

--------------------------------------------------------------------------------

Web access helper (optional; to snapshot docs into repo)

Use `scripts/fetch_url.py` to save allowlisted pages/API responses to `data/web/` so the assistant can read them offline.
