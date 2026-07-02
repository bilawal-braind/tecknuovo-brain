#!/usr/bin/env python3
"""Layer 2 evaluation with DeepEval — reference-free, research-backed metrics + G-Eval,
run against the golden signals the pipeline produced. Complements eval_goldens.py (which
scores vs our answer key). Uses your Azure gpt-4o-mini as the judge (no Docker, in-tenant).

Setup on the VM:
    pip3 install deepeval
    deepeval set-azure-openai \
      --openai-endpoint "$AZURE_OPENAI_ENDPOINT" \
      --openai-api-key "$AZURE_OPENAI_API_KEY" \
      --openai-model-name gpt-4o-mini \
      --deployment-name "$AZURE_OPENAI_DEPLOYMENT" \
      --openai-api-version 2024-08-01-preview

Run (after you've exported qa/goldens/predicted.json):
    python3 qa/deepeval_run.py --predicted qa/goldens/predicted.json

Metrics per signal:
    - Faithfulness   : is the signal grounded in the transcript (no hallucination)?
    - Correctness    : G-Eval — is it genuinely present + correctly typed per TN frameworks?
    - Action quality : G-Eval — is the suggested action specific and useful?
"""
import argparse, glob, json, os, sys

def load_predicted(path):
    raw = json.load(open(path))
    if isinstance(raw, list) and raw and isinstance(raw[0], dict) and "json_agg" in raw[0]:
        raw = raw[0]["json_agg"]
    return raw or []

def load_transcripts(folder):
    out = {}
    for p in glob.glob(os.path.join(folder, "*.txt")):
        out[os.path.splitext(os.path.basename(p))[0]] = open(p).read()
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--predicted", default="qa/goldens/predicted.json")
    ap.add_argument("--transcripts", default="qa/goldens/transcripts")
    ap.add_argument("--concurrency", type=int, default=3, help="parallel judge calls (lower if you hit 429s)")
    ap.add_argument("--throttle", type=int, default=2, help="seconds between calls")
    args = ap.parse_args()

    try:
        from deepeval import evaluate
        from deepeval.test_case import LLMTestCase, LLMTestCaseParams
        from deepeval.metrics import FaithfulnessMetric, GEval
    except Exception as e:
        print(f"DeepEval not installed or import failed: {e}\n`pip3 install deepeval` and run "
              "`deepeval set-azure-openai ...` first.", file=sys.stderr)
        return 1

    preds = load_predicted(args.predicted)
    transcripts = load_transcripts(args.transcripts)
    if not preds:
        print("No predicted signals found.", file=sys.stderr); return 1

    # async_mode=False -> each metric runs its sub-calls one at a time (gentler on the rate limit).
    correctness = GEval(
        name="Signal correctness",
        criteria=("Using the call transcript in the context, decide whether the extracted signal is "
                  "genuinely present in the call, correctly TYPED (risk / opportunity / people / update) "
                  "per Tecknuovo's frameworks, and accurately summarised. Penalise hallucinated, "
                  "mis-typed, or trivial-but-flagged signals."),
        evaluation_params=[LLMTestCaseParams.RETRIEVAL_CONTEXT, LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=0.7, async_mode=False,
    )
    action_quality = GEval(
        name="Action quality",
        criteria=("Judge whether the suggested action in the output is specific, sensible and genuinely "
                  "useful for a delivery/commercial team — not vague or generic. If the action is '(none)', "
                  "score low."),
        evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=0.6, async_mode=False,
    )
    faithfulness = FaithfulnessMetric(threshold=0.7, async_mode=False)

    cases = []
    for p in preds:
        tx = transcripts.get(p.get("scenario"), "")
        if not tx:
            continue
        out = (f"[{p.get('type')}" + (f" / {p.get('subtype')}" if p.get('subtype') else "") + "] "
               f"{p.get('summary')} — suggested action: {p.get('suggested_action','(none)')} "
               f"— quote: \"{p.get('quote')}\"")
        cases.append(LLMTestCase(
            input=f"Signal extracted from call '{p.get('scenario')}'.",
            actual_output=out,
            retrieval_context=[tx],
        ))

    print(f"Running DeepEval on {len(cases)} signals with Faithfulness + Correctness + Action quality "
          f"(concurrency={args.concurrency}, throttle={args.throttle}s)...\n")
    metrics = [faithfulness, correctness, action_quality]
    # Run fully SERIALLY (run_async=False) so we never burst past the Azure rate limit,
    # and don't abort on a stray 429.
    try:
        from deepeval.evaluate.configs import AsyncConfig, ErrorConfig
    except Exception:
        try:
            from deepeval.evaluate import AsyncConfig, ErrorConfig  # older layout
        except Exception:
            AsyncConfig = ErrorConfig = None
    if AsyncConfig and ErrorConfig:
        evaluate(cases, metrics,
                 async_config=AsyncConfig(run_async=False),
                 error_config=ErrorConfig(ignore_errors=True))
    else:
        evaluate(cases, metrics)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
