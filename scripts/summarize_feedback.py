#!/usr/bin/env python3
import json, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
FB_FILE = ROOT / "data" / "feedback" / "ratings.jsonl"
OUT_PREF = ROOT / "data" / "feedback" / "preferences.json"

def main():
    if not FB_FILE.exists():
        print("No feedback yet")
        return 0
    hooks = Counter()
    media_pref = Counter()
    durations = Counter()
    cuts = []
    liked = 0
    total = 0
    for line in FB_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except Exception:
            continue
        total += 1
        if rec.get("choice") == "liked":
            liked += 1
        for h in rec.get("kept_hooks", []) or []:
            hooks[h] += 1
        for mt, w in (rec.get("media_type_pref") or {}).items():
            media_pref[mt] += float(w)
        for k, w in (rec.get("duration_pref") or {}).items():
            durations[k] += float(w)
        if "cuts_per_30s" in rec:
            try:
                cuts.append(float(rec["cuts_per_30s"]))
            except Exception:
                pass
    pref = {
        "like_rate": (liked/total) if total else 0.0,
        "hook_types": {k: v/ max(1, sum(hooks.values())) for k, v in hooks.most_common(12)},
        "media_type_pref": {k: v/ max(1, sum(media_pref.values())) for k, v in media_pref.items()},
        "duration_pref": {k: v/ max(1, sum(durations.values())) for k, v in durations.items()},
        "cuts_per_30s": {
            "mean": (sum(cuts)/len(cuts)) if cuts else None,
        },
    }
    OUT_PREF.write_text(json.dumps(pref, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PREF}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
