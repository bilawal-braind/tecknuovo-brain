#!/usr/bin/env python3
"""Evaluate the classifier output as a Phoenix EXPERIMENT, so it shows under
"Datasets & Experiments" with a per-signal table of scores (not the drift/monitoring view).

Deterministic evaluators (always run — plain maths vs transcript + TN frameworks):
    groundedness, framework_validity, calibration
LLM-as-judge evaluators (added automatically when AZURE_OPENAI_* env vars are set):
    classification_correctness, quote_support, risk_category_fit,
    score_appropriateness, action_useful   (scored against TN's rubric)

Env for the LLM judge (reuses your gpt-4o-mini):
    export AZURE_OPENAI_API_KEY=...  AZURE_OPENAI_ENDPOINT=https://<res>.openai.azure.com
    export AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

Usage:
    python qa/phoenix_experiment.py --transcripts samples --signals src/data/snapshot.json
"""
import argparse, glob, json, os, re, sys

RUBRIC = """TECKNUOVO SIGNAL FRAMEWORKS — score strictly against these:
- TYPES: risk (threatens a sale/SOW or reputation); opportunity (needs a commercial action —
  extension/new work/scope growth); people (joiners/leavers, morale, SC clearance, capacity);
  update (delivery progress, milestones, decisions).
- RISK: one of ~14 categories; severity = likelihood(1-5) x impact(1-5) on a 5x5 matrix.
- OPPORTUNITY: NETWORKS framework out of 40; strength depends on WHO said it (budget-holder > admin).
- Precision over recall — only real, material signals."""

def norm(s): return re.sub(r"\s+", " ", (s or "").lower()).strip()

def details_of(s):
    d = s.get("details") or {}
    if isinstance(d, str):
        try: d = json.loads(d)
        except Exception: d = {}
    return d if isinstance(d, dict) else {}

# ---- scoring primitives (operate on plain fields so they work as Phoenix evaluators) ----
def _grounded(quote, transcript):
    q, ctx = norm(quote), norm(transcript)
    if not q: return 0.0
    if q in ctx: return 1.0
    w = [x for x in q.split() if len(x) > 3]
    return round(sum(1 for x in w if x in ctx) / len(w), 2) if w else 0.0

def _framework(t, L, I, net):
    t = (t or "").lower()
    if t == "risk":
        return 1.0 if isinstance(L, (int, float)) and isinstance(I, (int, float)) and 1 <= L <= 5 and 1 <= I <= 5 else 0.0
    if t == "opportunity":
        return 1.0 if isinstance(net, (int, float)) and 0 < net <= 40 else 0.0
    return 1.0

def _calibration(t, conf, L, I, net):
    t = (t or "").lower()
    try: stored = float(conf)
    except (TypeError, ValueError): return 1.0
    exp = None
    if t == "risk" and L and I: exp = 100 * L * I / 25
    elif t == "opportunity" and net: exp = 100 * net / 40
    if exp is None: return 1.0
    return round(max(0.0, 1 - abs(stored - exp) / 100), 2)

# ---- LLM judge ----
def azure_client():
    key, ep = os.environ.get("AZURE_OPENAI_API_KEY"), os.environ.get("AZURE_OPENAI_ENDPOINT")
    if not key or not ep: return None, None
    try:
        from openai import AzureOpenAI
    except Exception:
        print("(`pip install openai` to enable the LLM judge.)"); return None, None
    c = AzureOpenAI(api_key=key, azure_endpoint=ep, api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"))
    return c, os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

JUDGES = {
    "classification_correctness": "Is the signal TYPE (risk/opportunity/people/update) correct per the rubric?",
    "quote_support": "Does the quote actually support the summary and classification?",
    "risk_category_fit": "For a risk, are the category and severity (likelihood x impact) appropriate for the transcript? If not a risk, score 1.0.",
    "score_appropriateness": "Do the framework scores (likelihood/impact, or NETWORKS total) look appropriate given who said it and the transcript?",
    "action_useful": "Is the suggested action specific and genuinely useful?",
}

def _judge(client, dep, question, out, transcript):
    prompt = f"""{RUBRIC}

TRANSCRIPT (context):
{(transcript or '')[:6000]}

SIGNAL:
- type/subtype: {out.get('type')} / {out.get('subtype')}
- summary: {out.get('summary')}
- quote: {out.get('quote')}
- likelihood/impact/NETWORKS: {out.get('likelihood')}/{out.get('impact')}/{out.get('networks_total')}
- suggested_action: {out.get('suggested_action')}

QUESTION: {question}
Reply ONLY JSON: {{"score": <float 0.0-1.0>, "reason": "<one short sentence>"}} (1.0 = fully correct)."""
    try:
        r = client.chat.completions.create(model=dep, temperature=0, messages=[{"role": "user", "content": prompt}])
        m = re.search(r"\{.*\}", r.choices[0].message.content, re.S)
        return float(json.loads(m.group(0)).get("score", 0.0)) if m else 0.0
    except Exception as e:
        print(f"  (judge error: {e})"); return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcripts", default="samples")
    ap.add_argument("--signals", default="src/data/snapshot.json")
    args = ap.parse_args()

    data = json.load(open(args.signals))
    sigs = data.get("signals", []) if isinstance(data, dict) else data
    calls = data.get("calls", []) if isinstance(data, dict) else []
    by_call = {c.get("id"): (c.get("transcript") or "") for c in calls}
    combined = " ".join(by_call.values()) or norm(" ".join(open(p).read() for p in sorted(glob.glob(os.path.join(args.transcripts, "*.txt")))))

    # One flat row per signal — everything an evaluator needs, no nested objects.
    rows = []
    for s in sigs:
        d = details_of(s)
        rows.append({
            "signal_id": str(s.get("id") or len(rows)),
            "transcript": by_call.get(s.get("call_id")) or combined,
            "type": s.get("type"), "subtype": s.get("subtype") or "",
            "summary": s.get("summary") or "", "quote": s.get("quote") or "",
            "confidence": s.get("confidence"),
            "likelihood": d.get("likelihood"), "impact": d.get("impact"),
            "networks_total": d.get("networks_total"), "band": d.get("band") or "",
            "suggested_action": s.get("suggested_action") or "",
        })

    client, dep = azure_client()
    use_llm = client is not None

    # Always print the headline numbers so you get them even if the UI hiccups.
    g = [_grounded(r["quote"], r["transcript"]) for r in rows]
    f = [_framework(r["type"], r["likelihood"], r["impact"], r["networks_total"]) for r in rows]
    c = [_calibration(r["type"], r["confidence"], r["likelihood"], r["impact"], r["networks_total"]) for r in rows]
    print(f"\nEvaluating {len(rows)} signals | LLM judge: {'ON (' + dep + ')' if use_llm else 'OFF — set AZURE_OPENAI_* to add it'}")
    print("-" * 56)
    for name, vals in [("groundedness", g), ("framework_validity", f), ("calibration", c)]:
        print(f"  {name:<20} {sum(vals) / len(vals) * 100:5.1f}%")

    # ---- Log as a Phoenix experiment (Datasets & Experiments tab) ----
    try:
        import pandas as pd
        import phoenix as px
        from phoenix.experiments import run_experiment

        px.launch_app()
        df = pd.DataFrame(rows)
        client_px = px.Client()
        out_keys = ["type", "subtype", "summary", "quote", "confidence", "likelihood", "impact", "networks_total", "band", "suggested_action"]
        dataset = client_px.upload_dataset(
            dataframe=df,
            dataset_name="tn-signal-quality",
            input_keys=["transcript"],
            output_keys=out_keys,
            metadata_keys=["signal_id"],
        )

        def task(example):
            return example.output

        def groundedness(output, input):
            return _grounded(output.get("quote"), input.get("transcript"))
        def framework_validity(output):
            return _framework(output.get("type"), output.get("likelihood"), output.get("impact"), output.get("networks_total"))
        def calibration(output):
            return _calibration(output.get("type"), output.get("confidence"), output.get("likelihood"), output.get("impact"), output.get("networks_total"))

        evaluators = [groundedness, framework_validity, calibration]

        if use_llm:
            def _mk(qkey, question):
                def _fn(output, input):
                    return _judge(client, dep, question, output, input.get("transcript"))
                _fn.__name__ = qkey
                return _fn
            evaluators += [_mk(k, q) for k, q in JUDGES.items()]

        run_experiment(dataset, task, evaluators=evaluators, experiment_name="signal-quality")
        print("\nOpen Phoenix -> http://localhost:6006  →  Datasets & Experiments → tn-signal-quality")
        input("Press Enter to stop the Phoenix server...\n")
    except Exception as e:
        print(f"\n(Could not create the Phoenix experiment on this version — {e})")
        print("The scores above are complete. Paste this error and I'll match it to your Phoenix version.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
