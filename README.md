# Travel Reels RAG — Multi-Trip Content Creation System

This system is a comprehensive RAG pipeline designed to ideate and produce daily short-form travel videos (Instagram Reels, YouTube Shorts) across all your trips. Vietnam is the initial dataset, but the system will expand as you add more travel destinations.

## Core Philosophy

This is **not** a Vietnam-specific system. It's a **multi-trip content creation platform** that uses your actual footage, travel documentation, and personal style to generate grounded, viral-ready travel content. The system learns your style over time and ensures all outputs are strictly based on your real experiences and footage.

## Core Data Sources

The system grounds all outputs in these key files (located in `data/source/`):

1. **Travel Files Directory.csv** — Master inventory of your actual clips/photos with enriched metadata (enrichment_raw, story_description, location, time_of_day, people, etc.)
2. **Master_Viral_Travel_Reels_Playbook.txt** — Distilled viral frameworks from successful Indian travel creators (hooks, pacing, cuts/30s, structure)
3. **Vietnam Daywise Narrations Transcripts.txt** — Day-by-day detailed trip narrations (will expand with new trips)
4. **vietnam_trip_costs - Trip Cost (Audience).csv** — Complete budget breakdown for cost-related content
5. **VIPIN CHAHAL - COMPLETE STYLE DOCUMENTATION.txt** — Personal tone, speaking style, and creative preferences

*Note: Additional personality questionnaires and style documents can be added if the system needs deeper personality understanding.*

## Complete Workflow

### Step 1: Ideation (Two Modes)

**Mode A: Generate Ideas**
- Input: "Generate N ideas for [trip/theme]"
- System analyzes all source files to propose grounded ideas
- Output: Multiple idea cards with reasoning

**Mode B: Seed Idea Development**
- Input: Your seed idea or concept
- System solidifies and organizes it using viral frameworks
- Output: Refined idea card based on available footage

**Required Reasoning Process:**
The LLM must analyze:
- **Travel Files Directory** (`enrichment_raw` column) to understand available clip types, quality, and themes
- **Master Viral Playbook** to frame ideas into proven viral structures
- **Daywise Narrations** to build realistic storylines aligned to actual travel experiences
- **Trip Costs** to inject budget proofs/overlays when relevant
- **Style Documentation** to match personal voice and preferences

**Output: Idea Card**
- Title + concise summary
- Storyline broken into mini-chapters
- Shot allocation per chapter (targeting Playbook density)
- Reasoning based on available footage themes

### Step 2: EDL Generation

**Input:** Finalized Idea Card
**Process:** Generate complete Edit Decision List with:
- One best real clip per shot (filename, clip_id, story_description from `enrichment_raw`)
- Shot math (durations, cuts/30s calculations)
- Strict grounding in captured footage
- Quality ranking (stable/gimbal preferred, avoid blurry/shaky)

**Output:** Final EDL ready for editor handoff

### Step 3: Script Generation

**Input:** Finalized Idea Card + EDL + all relevant source files
**Process:** Generate Hinglish voice-over script using:
- Personal style documentation (Vipin/Divya/Both personas)
- Daywise narrations for authentic storytelling
- Trip costs for budget-related content
- EDL timing alignment

**Output:** 
- Human-readable script in requested style
- Two SSML versions (11Labs compatible) for TTS testing

### Step 4: Voice-Over Generation

**Input:** Finalized script + SSML versions
**Process:** Generate voice-over using 11Labs API
**Output:** Audio files ready for video editing

### Step 5: Music Generation (Optional)

**Input:** Script + voice-over duration
**Process:** Generate Suno AI prompt for custom background music
**Alternative:** Use trending Instagram audio instead
**Output:** Custom music or trending audio selection

### Step 6: Editor Handoff

**Input:** All finalized components
**Output:** Complete package including:
- Finalized Idea Card
- EDL with exact clip references
- Script with VO timing
- Audio files (VO + music)
- Footage references for editor assembly

## Technical Stack

- **Vector DB**: Qdrant with hierarchical chunking
- **Backend**: FastAPI with OpenRouter (primary) + OpenAI (fallback)
- **Frontend**: Next.js with multi-step workflow UI
- **RAG Toggle**: Enable/disable document grounding per conversation
- **Pipeline**: Automated or manual step-by-step progression

## Self-Learning Features

- **Auto-save**: All stages saved to `out/runs/<timestamp>/`
- **Preference Learning**: System learns from user feedback and choices
- **Session Memory**: Avoids repeating finalized ideas within sessions
- **Style Evolution**: Incorporates feedback to improve future generations

## API Configuration

Add to your `.env` file:

```bash
# Primary API (recommended)
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=travel-reels-rag

# Fallback API
OPENAI_API_KEY=your_openai_key_here

# Vector Database
QDRANT_URL=http://localhost:6333
EMBEDDINGS_MODEL=text-embedding-3-large
```

## Running the System

### Docker Compose (Recommended)
```bash
docker compose up -d
```
Services: Qdrant (6333), FastAPI server (8000), Web UI (3000)

### Manual Setup
```bash
# Backend
pip install -r requirements.txt
uvicorn server.app:app --host 0.0.0.0 --port 8000

# Frontend
npm install
npm run dev
```

## Data Expansion

As you travel to new destinations:
1. Add new trip files to `data/source/`
2. Update Travel Files Directory.csv with new footage
3. Add trip-specific narrations and cost breakdowns
4. Re-index the vector database
5. System automatically adapts to new content

The system is designed to scale across unlimited trips while maintaining the same high-quality, grounded content generation approach.

## License
MIT