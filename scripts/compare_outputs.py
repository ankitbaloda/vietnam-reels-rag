#!/usr/bin/env python3
import argparse, json, re, sys
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path(__file__).resolve().parents[1]
FB_DIR = ROOT / "data" / "feedback"
DIFF_DIR = FB_DIR / "diffs"

def is_hindi(text: str) -> bool:
    # crude: presence of Devanagari block
    return any('\u0900' <= ch <= '\u097F' for ch in text)

def sent_split(text: str):
    # simple sentence split on . ! ? or newline
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]

def word_diff(a: str, b: str):
    sm = SequenceMatcher(a=a.split(), b=b.split())
    changes = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != 'equal':
            changes.append({
                'op': tag,
                'a': ' '.join(a.split()[i1:i2]),
                'b': ' '.join(b.split()[j1:j2])
            })
    return changes

def compare_text(orig: str, final: str):
    orig_sents = sent_split(orig)
    final_sents = sent_split(final)
    # align greedily by highest similarity
    used = set()
    pairs = []
    for i, s in enumerate(orig_sents):
        best = (-1.0, -1)
        for j, t in enumerate(final_sents):
            if j in used: continue
            ratio = SequenceMatcher(a=s, b=t).ratio()
            if ratio > best[0]:
                best = (ratio, j)
        if best[1] != -1:
            used.add(best[1])
            pairs.append((i, best[1], best[0]))

    added = [final_sents[j] for j in range(len(final_sents)) if j not in {j for _, j, _ in pairs}]
    removed = [orig_sents[i] for i in range(len(orig_sents)) if i not in {i for i, _, _ in pairs}]
    modified = []
    for i, j, score in pairs:
        if score < 0.98:  # treat as modified
            modified.append({
                'orig_idx': i,
                'final_idx': j,
                'similarity': round(score, 3),
                'orig': orig_sents[i],
                'final': final_sents[j],
                'word_changes': word_diff(orig_sents[i], final_sents[j]),
                'lang_shift': {
                    'orig_hindi': is_hindi(orig_sents[i]),
                    'final_hindi': is_hindi(final_sents[j])
                }
            })
    return {
        'added_sents': added,
        'removed_sents': removed,
        'modified_sents': modified,
        'stats': {
            'orig_sent_count': len(orig_sents),
            'final_sent_count': len(final_sents),
        }
    }

def extract_json_block(text: str):
    # naive: find first fenced json block
    m = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", text)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None

def compare_edl(orig_text: str, final_text: str):
    o = extract_json_block(orig_text) or {}
    f = extract_json_block(final_text) or {}
    diffs = {'changed_shots': []}
    o_edl = o.get('edl_alignment') or o.get('edl') or []
    f_edl = f.get('edl_alignment') or f.get('edl') or []
    for idx, (os, fs) in enumerate(zip(o_edl, f_edl)):
        oc = (os.get('candidate_clips') or [os.get('clip') or {}])
        fc = (fs.get('candidate_clips') or [fs.get('clip') or {}])
        o_best = oc[0] if oc else {}
        f_best = fc[0] if fc else {}
        if o_best.get('clip_id') != f_best.get('clip_id'):
            diffs['changed_shots'].append({
                'shot_index': idx,
                'from': {'clip_id': o_best.get('clip_id'), 'media_type': o_best.get('media_type')},
                'to': {'clip_id': f_best.get('clip_id'), 'media_type': f_best.get('media_type')},
            })
    return diffs

def main(argv):
    ap = argparse.ArgumentParser(description='Compare generated vs final outputs and log diff')
    ap.add_argument('--stage', required=True, choices=['ideation','script','edl','music'])
    ap.add_argument('--orig', required=True, help='Path to original generated file')
    ap.add_argument('--final', required=True, help='Path to final liked/modified file')
    ap.add_argument('--run-id', help='Run id for naming the diff file')
    args = ap.parse_args(argv)

    orig = Path(args.orig).read_text(encoding='utf-8')
    final = Path(args.final).read_text(encoding='utf-8')
    report = {
        'stage': args.stage,
        'text_diff': compare_text(orig, final),
    }
    if args.stage in ('ideation','edl'):
        report['edl_changes'] = compare_edl(orig, final)

    DIFF_DIR.mkdir(parents=True, exist_ok=True)
    name = (args.run_id or 'manual') + f'_{args.stage}.json'
    outp = DIFF_DIR / name
    outp.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote diff: {outp}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
