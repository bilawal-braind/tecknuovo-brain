#!/usr/bin/env python3
"""Score the pipeline's output on the golden test set — the metrics that actually test
whether the AI CLASSIFIES correctly (not just structural checks).

Ground truth = qa/goldens/specs.py (what we planted).
Predicted    = signals the pipeline produced for the golden calls, exported from the DB:

    SELECT json_agg(t) FROM (
      SELECT c.dedup_key AS scenario, s.type, s.subtype, s.quote, s.summary, s.confidence, s.details
      FROM signals s JOIN calls c ON c.id = s.call_id
      WHERE c.dedup_key LIKE 'gold-%'
    ) t;

Paste that result into qa/goldens/predicted.json, then:
    python qa/eval_goldens.py --predicted qa/goldens/predicted.json

Metrics: recall (did it catch planted signals), precision (did it invent extras),
F1, type accuracy, severity accuracy (risks), and trap violations (flagged a line that
should NOT be a signal). Optional: --judge adds a DeepEval/LLM correctness score.
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "goldens"))
from specs import SPECS  # noqa: E402

def words(s): return set(w for w in re.sub(r"[^a-z0-9 ]", " ", (s or "").lower()).split() if len(w) > 3)

def overlap(planted_line, pred_text):
    pw = words(planted_line)
    if not pw: return 0.0
    return len(pw & words(pred_text)) / len(pw)

def ptype(t):
    t = (t or "").lower()
    return "opportunity" if "opp" in t else "risk" if "risk" in t else "people" if ("people" in t or "talent" in t) else "update"

def load_predicted(path):
    raw = json.load(open(path))
    if isinstance(raw, list) and raw and isinstance(raw[0], dict) and "json_agg" in raw[0]:
        raw = raw[0]["json_agg"]
    return raw or []

def details(p):
    d = p.get("details") or {}
    if isinstance(d, str):
        try: d = json.loads(d)
        except Exception: d = {}
    return d if isinstance(d, dict) else {}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--predicted", default="qa/goldens/predicted.json")
    ap.add_argument("--overlap", type=float, default=0.5, help="word-overlap threshold to count a match")
    ap.add_argument("--judge", action="store_true", help="add an LLM correctness score (needs AZURE_OPENAI_*)")
    args = ap.parse_args()

    preds = load_predicted(args.predicted)
    by_scn = {}
    for p in preds:
        by_scn.setdefault(p.get("scenario"), []).append(p)

    TP = FN = FP = 0
    type_ok = type_tot = 0
    sev_err, sev_n, sev_within = 0.0, 0, 0
    trap_hits = 0
    per_scn = []

    for spec in SPECS:
        got = list(by_scn.get(spec["id"], []))
        used = set()
        planted, matched = spec["planted"], 0
        for pl in planted:
            best, bi = args.overlap, None
            for i, pr in enumerate(got):
                if i in used: continue
                ov = overlap(pl["line"], f"{pr.get('quote','')} {pr.get('summary','')}")
                if ov >= best:
                    best, bi = ov, i
            if bi is not None:
                used.add(bi); matched += 1; TP += 1
                pr = got[bi]
                # type accuracy on the matched pair
                type_tot += 1
                if ptype(pr.get("type")) == pl["type"]: type_ok += 1
                # severity accuracy for risks
                if pl["type"] == "risk" and "likelihood" in pl:
                    d = details(pr); ps = pl["likelihood"] * pl["impact"]
                    if isinstance(d.get("likelihood"), (int, float)) and isinstance(d.get("impact"), (int, float)):
                        e = abs(d["likelihood"] * d["impact"] - ps); sev_err += e; sev_n += 1
                        if e <= 6: sev_within += 1
            else:
                FN += 1
        # unmatched predicted in this scenario = false positives
        fp_here = [got[i] for i in range(len(got)) if i not in used]
        FP += len(fp_here)
        # trap violations: a predicted signal that matches a trap line
        for pr in fp_here:
            for tr in spec["traps"]:
                if overlap(tr["line"], f"{pr.get('quote','')} {pr.get('summary','')}") >= args.overlap:
                    trap_hits += 1; break
        per_scn.append((spec["id"], matched, len(planted), len(fp_here)))

    recall = TP / (TP + FN) if TP + FN else 0
    precision = TP / (TP + FP) if TP + FP else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0

    print(f"\nGolden eval — {len(SPECS)} scenarios, {sum(len(s['planted']) for s in SPECS)} planted signals, {len(preds)} predicted\n" + "-" * 60)
    print(f"  Recall (caught planted)      {recall*100:5.1f}%   ({TP}/{TP+FN})")
    print(f"  Precision (not invented)     {precision*100:5.1f}%   ({TP}/{TP+FP})")
    print(f"  F1                           {f1*100:5.1f}%")
    print(f"  Type accuracy (matched)      {(type_ok/type_tot*100) if type_tot else 0:5.1f}%   ({type_ok}/{type_tot})")
    if sev_n:
        print(f"  Severity within tolerance    {sev_within/sev_n*100:5.1f}%   (mean L×I error {sev_err/sev_n:.1f} of 25)")
    print(f"  Trap violations (should be 0){trap_hits:5d}")
    print("\nPer scenario (matched / planted, +false-positives):")
    for sid, m, tot, fp in per_scn:
        flag = "" if (m == tot and fp == 0) else "  <-- check"
        print(f"  {sid:<32} {m}/{tot}  +{fp}{flag}")

    if args.judge:
        run_judge(by_scn)
    return 0

def run_judge(by_scn):
    key, ep = os.environ.get("AZURE_OPENAI_API_KEY"), os.environ.get("AZURE_OPENAI_ENDPOINT")
    if not key or not ep:
        print("\n(--judge needs AZURE_OPENAI_* — skipped.)"); return
    try:
        from openai import AzureOpenAI
    except Exception:
        print("\n(`pip install openai` for --judge — skipped.)"); return
    c = AzureOpenAI(api_key=key, azure_endpoint=ep, api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"))
    dep = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
    scores = []
    for spec in SPECS:
        for pr in by_scn.get(spec["id"], []):
            q = (f"A signal classifier produced this from a {spec['call_type']} for {spec['account']}:\n"
                 f"type={pr.get('type')} summary={pr.get('summary')} quote={pr.get('quote')}\n"
                 "Is this a correct, useful, correctly-typed signal (risk/opportunity/people/update)? "
                 'Reply ONLY {"score":0.0-1.0}.')
            try:
                r = c.chat.completions.create(model=dep, temperature=0, messages=[{"role": "user", "content": q}])
                m = re.search(r'"score"\s*:\s*([0-9.]+)', r.choices[0].message.content)
                if m: scores.append(float(m.group(1)))
            except Exception:
                pass
    if scores:
        print(f"\n  LLM correctness (judge)      {sum(scores)/len(scores)*100:5.1f}%   (n={len(scores)})")

if __name__ == "__main__":
    raise SystemExit(main())
