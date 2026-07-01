#!/usr/bin/env python3
"""Evaluate classifier output on quality dimensions beyond right/wrong, and log to local Opik.

Deterministic metrics (no LLM, run instantly): groundedness, framework validity, calibration.
Optionally add Opik's LLM-as-judge metrics later for a correctness score.

Usage:
    python qa/opik_eval.py --transcripts samples --signals qa/signals.json
"""
import argparse, glob, json, os, re, sys

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()

def load_transcripts(folder: str) -> str:
    """All sample transcripts concatenated — the 'context' a signal must be grounded in."""
    blobs = []
    for path in sorted(glob.glob(os.path.join(folder, "*.txt"))):
        with open(path) as fh:
            blobs.append(fh.read())
    return norm("\n".join(blobs))

# ---- deterministic metrics -------------------------------------------------
def score_groundedness(sig: dict, context: str) -> float:
    """1.0 if the signal's quote appears (roughly) in the transcript, else a fuzzy word-overlap."""
    quote = norm(sig.get("quote"))
    if not quote:
        return 0.0
    if quote in context:
        return 1.0
    words = [w for w in quote.split() if len(w) > 3]
    if not words:
        return 0.0
    hit = sum(1 for w in words if w in context)
    return round(hit / len(words), 2)

def score_framework_validity(sig: dict) -> float:
    d = sig.get("details") or {}
    if isinstance(d, str):
        try: d = json.loads(d)
        except Exception: d = {}
    t = (sig.get("type") or "").lower()
    if t == "risk":
        L, I = d.get("likelihood"), d.get("impact")
        return 1.0 if (isinstance(L, (int, float)) and isinstance(I, (int, float)) and 1 <= L <= 5 and 1 <= I <= 5) else 0.0
    if t == "opportunity":
        n = d.get("networks_total")
        return 1.0 if (isinstance(n, (int, float)) and 0 < n <= 40) else 0.0
    return 1.0  # update / people carry no framework score

def score_calibration(sig: dict) -> float:
    """Recompute framework confidence from the scores and compare to the stored confidence."""
    d = sig.get("details") or {}
    if isinstance(d, str):
        try: d = json.loads(d)
        except Exception: d = {}
    t = (sig.get("type") or "").lower()
    stored = sig.get("confidence")
    try: stored = float(stored)
    except (TypeError, ValueError): return 1.0
    expected = None
    if t == "risk" and d.get("likelihood") and d.get("impact"):
        expected = 100.0 * (d["likelihood"] * d["impact"]) / 25.0
    elif t == "opportunity" and d.get("networks_total"):
        expected = 100.0 * d["networks_total"] / 40.0
    if expected is None:
        return 1.0
    return round(max(0.0, 1.0 - abs(stored - expected) / 100.0), 2)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcripts", default="samples")
    ap.add_argument("--signals", default="qa/signals.json")
    args = ap.parse_args()

    context = load_transcripts(args.transcripts)
    if not context:
        print(f"No transcripts found in {args.transcripts}/", file=sys.stderr); return 1
    with open(args.signals) as fh:
        signals = json.load(fh)
    if not isinstance(signals, list):
        signals = signals.get("audit") or signals.get("signals") or []

    # Try to log to local Opik; fall back to console-only if it's not running.
    opik_client = None
    try:
        from opik import Opik
        opik_client = Opik(project_name="tn-second-brain-eval")
    except Exception as e:
        print(f"(Opik not logging — {e}. Printing scores only.)")

    totals = {"groundedness": 0.0, "framework_validity": 0.0, "calibration": 0.0}
    for sig in signals:
        scores = {
            "groundedness": score_groundedness(sig, context),
            "framework_validity": score_framework_validity(sig),
            "calibration": score_calibration(sig),
        }
        for k, v in scores.items():
            totals[k] += v
        if opik_client:
            trace = opik_client.trace(
                name=f"{sig.get('type')}: {(sig.get('summary') or '')[:60]}",
                input={"quote": sig.get("quote"), "details": sig.get("details")},
                output={"type": sig.get("type"), "confidence": sig.get("confidence")},
            )
            for name, value in scores.items():
                trace.log_feedback_score(name=name, value=value)

    n = max(1, len(signals))
    print(f"\nEvaluated {len(signals)} signals across {args.transcripts}/")
    print("-" * 44)
    for k, v in totals.items():
        print(f"  {k:<20} {v / n * 100:5.1f}%")
    if opik_client:
        opik_client.flush()
        print("\nLogged to Opik → http://localhost:5173")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
