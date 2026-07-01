# Opik — local evaluation layer (validation demo)

Opik (by Comet) is our **build-time evaluation harness** — it lets us show, beyond "right/wrong",
*how well* the classifier is doing on several quality dimensions. It runs **locally / self-hosted**,
so no client data leaves the machine. It is **not** part of the permanent handover — the permanent
learning loop is our own Observability dashboard + `feedback` table. Opik is for validation +
"wow factor" during review.

## 1. Spin it up locally (one time)
Opik ships as a docker-compose stack. It brings up its **own** dependencies (Redis, Clickhouse,
MySQL) inside containers — you never configure them yourself.

```bash
git clone https://github.com/comet-ml/opik.git
cd opik
./opik.sh            # starts the stack via docker compose
# UI is then at http://localhost:5173
```
To stop: `./opik.sh --stop`.

> Keep-it-simple note: you don't touch Redis/Clickhouse — compose manages them. If you ever want
> them gone entirely, `docker compose down` removes the whole stack cleanly.

## 2. Point the SDK at your local instance
```bash
pip install opik
opik configure --use-local     # or set OPIK_URL_OVERRIDE=http://localhost:5173/api
```

## 3. Get the signals to evaluate
Run the two sample transcripts through the pipeline first (see `db/sample-inbox-seed.sql`), then
export what the classifier produced:
```bash
# from the VM, or wherever the Read API is reachable:
curl -s "$API_URL/api/signals?limit=200" -H "Authorization: Bearer $API_TOKEN" > qa/signals.json
```

## 4. Run the evaluation
```bash
python qa/opik_eval.py --transcripts samples --signals qa/signals.json
```
This scores every signal on the dimensions below and logs them to the local Opik UI, where you
can click into each run, see the transcript, the signal, the quote, and the scores.

## The dimensions we score (beyond right/wrong)
| Dimension | Question it answers | How |
|---|---|---|
| **Groundedness** | Is the signal's quote actually in the transcript (not hallucinated)? | deterministic substring/fuzzy match |
| **Framework validity** | Risk has likelihood+impact (1–5); opportunity has NETWORKS total? | deterministic schema check |
| **Confidence calibration** | Does the framework-derived confidence look sane vs the scores? | deterministic recompute + compare |
| **Correctness** *(optional)* | Is the classification right per the rubric? | Opik LLM-as-judge metric |

The first three need no LLM and run instantly. The optional correctness judge uses Opik's built-in
LLM metrics (Hallucination / relevance) and needs a model key — add it once you want that layer.
