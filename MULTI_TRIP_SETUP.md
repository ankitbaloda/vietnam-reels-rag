# Multi-Trip RAG System - Setup Guide

## Directory Structure
```
data/source/
├── trips/
│   ├── vietnam/
│   │   ├── transcripts.txt
│   │   ├── costs.csv
│   │   ├── style_guide.txt
│   │   └── metadata.json
│   ├── thailand/      # Future trip
│   ├── japan/         # Future trip
│   └── bali/          # Future trip
├── global/
│   ├── Master_Viral_Travel_Reels_Playbook.txt
│   └── Travel Files Directory.csv
└── templates/
    └── trip_template.json
```

## Adding a New Trip

### Step 1: Create Trip Directory
```bash
mkdir -p data/source/trips/NEW_DESTINATION
```

### Step 2: Add Trip Files
- `transcripts.txt` - Daily narrations and experiences
- `costs.csv` - Trip expenses and budget breakdown
- `style_guide.txt` - Content style preferences for this trip
- `metadata.json` - Trip metadata (copy from template)

### Step 3: Update Metadata
Edit `metadata.json` with:
- trip_id: unique identifier
- destination: country/region name
- dates: trip start and end dates
- budget: total costs and daily averages
- locations: cities and places visited
- themes: main content themes
- style_preferences: video style settings

### Step 4: Re-index Vector Database
```bash
python scripts/build_hierarchical_index.py --source-dir data/source --collection flowise_reels
```

## Trip Selection in UI

Future enhancement: Add trip selector dropdown in the UI to:
1. Choose which trip data to use for RAG queries
2. Apply trip-specific context and style
3. Filter content by destination and themes

## Benefits of Multi-Trip Structure

1. **Scalability**: Easy to add new destinations
2. **Context Isolation**: Each trip maintains its own context
3. **Style Consistency**: Trip-specific style guides
4. **Budget Tracking**: Per-trip cost analysis
5. **Content Variety**: Different themes per destination
6. **Global Knowledge**: Shared playbook across all trips