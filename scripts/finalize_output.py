#!/usr/bin/env python3
import argparse, shutil, sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'out'
INITIAL = OUT / 'initial'
FINAL = OUT / 'final'

STAGE_DEFAULTS = {
    'ideation': ('01_ideation_and_edl.md', 'ideation_'),
    # Align with run_pipeline.py which writes out/02_script_vipinclaude.md
    'script':   ('02_script_vipinclaude.md', 'script_'),
    # Two-step flow: EDL from outline writes out/01b_edl_from_outline.md
    # For single-pass ideation+EDL, you can still pass --final to override.
    'edl':      ('01b_edl_from_outline.md', 'edl_'),
    'music':    ('03_suno_prompt.txt', 'suno_'),
}

def latest_initial(prefix: str) -> Path | None:
    if not INITIAL.exists():
        return None
    cands = sorted(INITIAL.glob(f"{prefix}*"))
    return cands[-1] if cands else None

def main(argv):
    ap = argparse.ArgumentParser(description='Mark a file as final and compare against initial')
    ap.add_argument('stage', choices=['ideation','script','edl','music'])
    ap.add_argument('--session-id', help='Optional session id to update session memory')
    ap.add_argument('--final', dest='final_path', help='Path to the final file (defaults to latest stage output)')
    ap.add_argument('--orig', dest='orig_path', help='Path to the original initial file (defaults to latest initial by prefix)')
    args = ap.parse_args(argv)

    OUT.mkdir(parents=True, exist_ok=True)
    FINAL.mkdir(parents=True, exist_ok=True)

    out_name, prefix = STAGE_DEFAULTS[args.stage]
    final_src = Path(args.final_path) if args.final_path else (OUT / out_name)
    if not final_src.exists():
        raise SystemExit(f"Final source not found: {final_src}")

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    final_dst = FINAL / f"{args.stage}_final_{ts}{final_src.suffix}"
    shutil.copy2(final_src, final_dst)
    print(f"Saved final -> {final_dst}")

    # Try to diff against latest initial
    orig = Path(args.orig_path) if args.orig_path else latest_initial(prefix)
    if orig and orig.exists():
        try:
            from subprocess import run
            run([
                sys.executable,
                str(ROOT / 'scripts' / 'compare_outputs.py'),
                '--stage', args.stage,
                '--orig', str(orig),
                '--final', str(final_dst),
                '--run-id', ts
            ], check=False)
        except Exception:
            pass
    else:
        print('No initial file found to compare against; skipped diff')
    # Update session memory with finalized fingerprint for deduplication
    if args.session_id:
        try:
            from scripts.session_utils import load_state, save_state, compute_idea_fingerprint  # type: ignore
        except Exception:
            try:
                from session_utils import load_state, save_state, compute_idea_fingerprint  # type: ignore
            except Exception:
                load_state = save_state = compute_idea_fingerprint = None  # type: ignore
        if load_state and save_state and compute_idea_fingerprint:
            state = load_state(args.session_id)
            text = Path(final_dst).read_text(encoding='utf-8')
            # Use title + summary for a stable fingerprint
            import re
            m = re.search(r"Title\s*\(.*?\)\s*:\s*(.*)\n.*?Idea Summary\s*\n-\s*(.*)", text, flags=re.S|re.I)
            idea_key = (m.group(1) + " | " + m.group(2)) if m else text[:400]
            fp = compute_idea_fingerprint(idea_key)
            arr = set(state.get('finalized_ideas') or [])
            arr.add(fp)
            state['finalized_ideas'] = sorted(arr)
            save_state(args.session_id, state)
    return 0

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
