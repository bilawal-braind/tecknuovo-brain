#!/usr/bin/env python3
"""Evaluate classifier output on quality dimensions and view it in Arize Phoenix (no Docker).

Same three deterministic scores as opik_eval.py — groundedness, framework validity,
calibration — but launched in the Phoenix local UI (http://localhost:6006) instead of Opik.

Setup (one time):
    pip install arize-phoenix pandas

Run (from the dashboards/ folder, using signals.json exported from the API):
    python qa/phoenix_eval.py --transcripts samples --signals signals.json

On the VM you can persist to the existing Postgres instead of memory:
    export PHOENIX_SQL_DATABASE_URL=postgresql://<user>:<pw>@<host>:5432/<db>
"""
import argparse, glob, json, os, re, sys

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()

def load_transcripts(folder: str) -> str:
    blobs = []
    for path in sorted(glob.glob(os.path.join(folder, "*.txt"))):
        with open(path) as fh:
            blobs.append(fh.read())
    return norm("\n".join(blobs))

def _details(sig: dict) -> dict:
    d = sig.get("details") or {}
    if isinstance(d, str):
        try: return json.loads(d)
        except Exception: return {}
    return d if isinstance(d, dict) else {}

def score_groundedness(sig: dict, context: str) -> float:
    quote = norm(sig.get("quote"))
    if not quote:
        return 0.0
    if quote in context:
        return 1.0
    words = [w for w in quote.split() if len(w) > 3]
    if not words:
        return 0.0
    return round(sum(1 for w in words if w in context) / len(words), 2)

def score_framework_validity(sig: dict) -> float:
    d = _details(sig); t = (sig.get("type") or "").lower()
    if t == "risk":
        L, I = d.get("likelihood"), d.get("impact")
        return 1.0 if (isinstance(L, (int, float)) and isinstance(I, (int, float)) and 1 <= L <= 5 and 1 <= I <= 5) else 0.0
    if t == "opportunity":
        n = d.get("networks_total")
        return 1.0 if (isinstance(n, (int, float)) and 0 < n <= 40) else 0.0
    return 1.0

def score_calibration(sig: dict) -> float:
    d = _details(sig); t = (sig.get("type") or "").lower()
    try: stored = float(sig.get("confidence"))
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
    ap.add_argument("--signals", default="signals.json")
    args = ap.parse_args()

    context = load_transcripts(args.transcripts)
    if not context:
        print(f"No transcripts in {args.transcripts}/", file=sys.stderr); return 1
    with open(args.signals) as fh:
        signals = json.load(fh)
    if not isinstance(signals, list):
        signals = signals.get("audit") or signals.get("signals") or []

    rows = []
    for sig in signals:
        rows.append({
            "id": str(sig.get("id") or len(rows)),
            "type": sig.get("type"),
            "summary": (sig.get("summary") or "")[:120],
            "quote": (sig.get("quote") or "")[:160],
            "confidence": sig.get("confidence"),
            "groundedness": score_groundedness(sig, context),
            "framework_validity": score_framework_validity(sig),
            "calibration": score_calibration(sig),
        })

    # Console summary always prints (works with zero tools installed).
    n = max(1, len(rows))
    print(f"\nEvaluated {len(rows)} signals across {args.transcripts}/")
    print("-" * 44)
    for k in ("groundedness", "framework_validity", "calibration"):
        print(f"  {k:<20} {sum(r[k] for r in rows) / n * 100:5.1f}%")

    # Launch Phoenix if it's installed.
    try:
        import pandas as pd
        import phoenix as px
    except Exception as e:
        print(f"\n(Phoenix/pandas not installed — showed scores only. `pip install arize-phoenix pandas` for the UI. {e})")
        return 0

    df = pd.DataFrame(rows)
    schema = px.Schema(
        prediction_id_column_name="id",
        tag_column_names=["type", "summary", "quote", "confidence",
                          "groundedness", "framework_validity", "calibration"],
    )
    session = px.launch_app(primary=px.Inferences(df, schema))
    print(f"\nPhoenix UI → {session.url}")
    input("Press Enter to stop the Phoenix server...\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
