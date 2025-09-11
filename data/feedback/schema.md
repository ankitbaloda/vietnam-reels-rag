Schemas

ratings.jsonl (one JSON per line)
{
  "run_id": "2025-09-06T12-34-56Z",      // folder under out/runs/
  "stage": "ideation|script|edl|music",
  "choice": "liked|neutral|disliked",    // quick label
  "score": 0-100,                         // optional numeric score
  "model": "gpt-4o-mini",               // which model generated it
  "topic": "...",                       // topic/instruction
  "notes": "free-text user notes",
  "kept_hooks": ["..."],                // optional: hooks that survived
  "changed_shots": [{"from_clip_id":"...","to_clip_id":"..."}],
  "final_file": "relative/path/to/final.md or .json" // saved artifact
}

preferences.json (periodically updated)
{
  "hook_types": {"Budget": 0.72, "Mistake": 0.55, ...},
  "preferred_tags": ["sunrise","scooter","couple"],
  "cuts_per_30s": {"mean": 18.2, "p90": 24},
  "duration_pref": {"30s": 0.4, "60s": 0.6},
  "media_type_pref": {"video": 0.85, "photo": 0.15}
}
