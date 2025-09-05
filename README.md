# Vietnam RAG Reel Ideation System (No-Code, Flowise + Qdrant)

This repo lets you ideate, script, and prepare edit-ready EDLs for your Vietnam travel reels using your five documents:
1) Vietnam Daywise Narrations Transcripts.txt
2) vietnam_trip_costs - Trip Cost (Audience).csv
3) VIPIN CHAHAL - COMPLETE STYLE DOCUMENTATION.txt
4) Master_Viral_Travel_Reels_Playbook.txt
5) Travel Files Directory.csv

Stack (no-code):
- Flowise (drag-and-drop LLM pipelines)
- Qdrant (vector DB)
- OpenAI (Ideation + Suno prompt + Handoff)
- Anthropic Claude (Script in Vipin’s voice)

Run either locally (Docker Desktop) or GitHub Codespaces.

--------------------------------------------------------------------------------

Quick Start (local with Docker Desktop)

1) Install Docker Desktop.
2) Put your five files into data/source/ exactly as named (see data/README.md).
3) Copy .env.example to .env and fill:
   - OPENAI_API_KEY
   - ANTHROPIC_API_KEY
4) Run:
   docker compose up -d
5) Open Flowise at http://localhost:3000 (user/pass: admin/admin)
6) In Flowise, top-right → Import → import all flows in flows/*.flowise.json
7) Open each flow and set providers (OpenAI/Anthropic) in the UI if not picked up from environment.
8) Chat with “01_Ideation_And_EDL” flow to generate an Idea Card + EDL.

GitHub Codespaces (alternative)
- Create a Codespace -> run docker compose up -d -> forward port 3000 to public.
- Then repeat steps 6–8.

--------------------------------------------------------------------------------

Dev Container (VS Code / Codespaces)

- Open this repo in GitHub Codespaces or locally with VS Code + Dev Containers extension.
- The dev container includes Docker-in-Docker support. Inside the container, run:
  - `docker compose up -d`
- Access Flowise on the forwarded port 3000. Qdrant is on 6333.
- The container also auto-copies `.env.example` to `.env` if `.env` is missing—fill in your keys before running.

--------------------------------------------------------------------------------

Flows in this repo

- 00 Ingest Guardrail (prompt): Blocks output unless all required files are ingested.
- 01 Ideation + EDL (OpenAI): Builds the full “Idea Card” strictly from your clips and playbook guidance.
- 02 Script (Claude): Writes Vipin’s Hinglish script grounded in persona + narrations with VO timings.
- 03 Suno Prompt (OpenAI): Generates the music prompt aligned to pacing + mood.
- 04 Editor Handoff (OpenAI): Produces the Google Drive README with assembly instructions.

--------------------------------------------------------------------------------

Grounding + Guardrails

- The ideation flow requires four sources to be present:
  - Travel Files Directory.csv
  - Vietnam Daywise Narrations Transcripts.txt
  - vietnam_trip_costs - Trip Cost (Audience).csv
  - Master_Viral_Travel_Reels_Playbook.txt
- If any are missing or retrieval returns no relevant chunks, it returns nothing (as per your rule).
- Story Breakdown and EDL entries must reference ONLY clips that exist in Travel Files Directory.csv.
- Viral blueprint numbers (shots/30s, pacing, hooks) are pulled from the Playbook.
- Script uses Vipin persona + narrations; no hallucinations.

--------------------------------------------------------------------------------

Suggested first test

Once your five files are in data/source/:
- Open “01_Ideation_And_EDL” and ask:
  “Make a 40s reel from Ninh Binh Day 2 focusing on Mua Caves + Trang An. Budget reality vibe, fast pacing, 18–22 cuts/30s, include hook variations from Playbook.”

You’ll receive:
- A complete Idea Card (Title, Summary, Duration, Story Breakdown, Viral Blueprint, EDL with 2–3 candidates per shot).
- A JSON alongside it for the scripting flow.

Then:
- Paste it into “02_Script_VipinClaude” to get the script in Vipin’s Hinglish voice with VO durations.
- Feed Script + VO to “03_Suno_Prompt”.
- Finally run “04_Editor_Handoff” to generate the editor README.

--------------------------------------------------------------------------------

Maintenance

- Update your five sources in data/source/ and re-run the ideation flow (it re-ingests).
- Export Flowise flows (JSON) after any tweak and commit them to flows/.
- Never commit real API keys—use .env locally.

License: MIT