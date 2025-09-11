#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FB_DIR = ROOT / "data" / "feedback"
FB_FILE = FB_DIR / "ratings.jsonl"

def main(argv):
    p = argparse.ArgumentParser(description="Append a feedback record to ratings.jsonl")
    p.add_argument("run_id", help="Run identifier (e.g., out/runs/<timestamp>)")
    p.add_argument("stage", choices=["ideation","script","edl","music"]) 
    p.add_argument("choice", choices=["liked","neutral","disliked"]) 
    p.add_argument("topic", help="Topic/instruction for context")
    p.add_argument("model", help="Model used")
    p.add_argument("notes", nargs="?", default="")
    args = p.parse_args(argv)

    FB_DIR.mkdir(parents=True, exist_ok=True)
    rec = {
        "run_id": args.run_id,
        "stage": args.stage,
        "choice": args.choice,
        "topic": args.topic,
        "model": args.model,
        "notes": args.notes,
    }
    with FB_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"Appended feedback -> {FB_FILE}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
