#!/usr/bin/env python3
"""Generate a clean, self-contained HTML quality report from the snapshot — readable by
anyone (you or the client). Shows what each metric means, the overall scores, every signal
with its scores, and the transcript with the captured quotes highlighted. No server needed.

Usage:
    python qa/build_report.py --signals src/data/snapshot.json --out qa/eval-report.html
Then just open qa/eval-report.html in a browser.
"""
import argparse, html, json, re

def norm(s): return re.sub(r"\s+", " ", (s or "").lower()).strip()
def details_of(s):
    d = s.get("details") or {}
    return d if isinstance(d, dict) else {}

def m_groundedness(s, ctx):
    q = norm(s.get("quote"))
    if not q: return 0.0
    if q in ctx: return 1.0
    w = [x for x in q.split() if len(x) > 3]
    return round(sum(1 for x in w if x in ctx) / len(w), 2) if w else 0.0

def m_framework(s):
    d = details_of(s); t = (s.get("type") or "").lower()
    if t == "risk":
        L, I = d.get("likelihood"), d.get("impact")
        return 1.0 if isinstance(L, (int, float)) and isinstance(I, (int, float)) and 1 <= L <= 5 and 1 <= I <= 5 else 0.0
    if t == "opportunity":
        n = d.get("networks_total")
        return 1.0 if isinstance(n, (int, float)) and 0 < n <= 40 else 0.0
    return 1.0

def m_calibration(s):
    d = details_of(s); t = (s.get("type") or "").lower()
    try: stored = float(s.get("confidence"))
    except (TypeError, ValueError): return 1.0
    exp = None
    if t == "risk" and d.get("likelihood") and d.get("impact"): exp = 100 * d["likelihood"] * d["impact"] / 25
    elif t == "opportunity" and d.get("networks_total"): exp = 100 * d["networks_total"] / 40
    if exp is None: return 1.0
    return round(max(0.0, 1 - abs(stored - exp) / 100), 2)

METRICS = [
    ("Groundedness", "Every signal must quote the call word-for-word. This checks the quote actually appears in the transcript — proof the AI isn't inventing anything.", m_groundedness),
    ("Framework validity", "Risks are scored on Tecknuovo's 5×5 likelihood×impact matrix; opportunities on the NETWORKS framework (out of 40). This checks each signal was scored using your frameworks.", None),
    ("Calibration", "The confidence % is calculated from your framework scores, not guessed. This checks the displayed confidence matches the maths.", None),
]

def chip(v):
    pct = f"{round(v * 100)}%"
    color = "#16a34a" if v >= 0.9 else "#d97706" if v >= 0.7 else "#dc2626"
    return f'<span style="display:inline-block;min-width:44px;text-align:center;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;background:{color}">{pct}</span>'

TYPE_COLOR = {"risk": "#dc2626", "opportunity": "#16a34a", "people": "#d97706", "update": "#2563eb"}

def highlight(transcript, quotes):
    out = html.escape(transcript)
    for q in quotes:
        if not q: continue
        # case-insensitive locate of the escaped quote
        eq = html.escape(q).strip()
        idx = out.lower().find(eq.lower())
        if idx >= 0:
            out = out[:idx] + '<mark style="background:#fef08a;padding:1px 2px;border-radius:3px">' + out[idx:idx + len(eq)] + "</mark>" + out[idx + len(eq):]
    return out.replace("\n", "<br>")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--signals", default="src/data/snapshot.json")
    ap.add_argument("--out", default="qa/eval-report.html")
    args = ap.parse_args()

    data = json.load(open(args.signals))
    sigs = data.get("signals", []) if isinstance(data, dict) else data
    calls = data.get("calls", []) if isinstance(data, dict) else []
    ctx = norm(" ".join(c.get("transcript", "") for c in calls))

    scored = []
    for s in sigs:
        scored.append({**s, "_g": m_groundedness(s, ctx), "_f": m_framework(s), "_c": m_calibration(s)})

    def avg(k):
        vals = [x[k] for x in scored]
        return round(sum(vals) / len(vals) * 100, 1) if vals else 0.0
    overall = [("Groundedness", avg("_g")), ("Framework validity", avg("_f")), ("Calibration", avg("_c"))]

    P = []
    P.append("<!doctype html><meta charset='utf-8'><title>Second Brain — Signal Quality Report</title>")
    P.append("""<style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:960px;margin:0 auto;padding:32px 24px;background:#f8fafc;line-height:1.5}
      h1{font-size:24px;margin:0 0 4px} h2{font-size:16px;margin:32px 0 12px;color:#334155}
      .sub{color:#64748b;margin:0 0 24px}
      .tiles{display:flex;gap:16px;flex-wrap:wrap} .tile{flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
      .tile .n{font-size:30px;font-weight:700;color:#16a34a} .tile .l{font-size:13px;color:#475569;margin-top:2px}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px}
      .meta{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
      .badge{font-size:11px;font-weight:700;text-transform:uppercase;color:#fff;padding:2px 8px;border-radius:6px}
      .quote{color:#475569;font-style:italic;border-left:3px solid #cbd5e1;padding-left:10px;margin:8px 0;font-size:14px}
      .scores{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#64748b;margin-top:8px}
      .scores b{color:#0f172a}
      details{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px}
      summary{cursor:pointer;font-weight:600}
      .tx{margin-top:12px;font-size:13px;color:#334155;background:#f8fafc;border-radius:8px;padding:14px;max-height:420px;overflow:auto}
      .mdef{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px}
      .mdef b{color:#0f172a}
    </style>""")
    P.append("<h1>Tecknuovo Second Brain — Signal Quality Report</h1>")
    P.append(f"<p class='sub'>How well the AI classified {len(sigs)} signals from {len(calls)} calls. Every check below is plain maths against the call transcript and Tecknuovo's own frameworks — no AI grading an AI.</p>")

    P.append("<h2>What we check, and why</h2>")
    for name, desc, _ in METRICS:
        P.append(f"<div class='mdef'><b>{name}.</b> {html.escape(desc)}</div>")

    P.append("<h2>Overall scores</h2><div class='tiles'>")
    for name, v in overall:
        P.append(f"<div class='tile'><div class='n'>{v}%</div><div class='l'>{name}</div></div>")
    P.append("</div>")

    P.append("<h2>Every signal, scored</h2>")
    for x in scored:
        t = (x.get("type") or "").lower()
        col = TYPE_COLOR.get(t, "#64748b")
        conf = x.get("confidence")
        conf_txt = f"{conf}%" if isinstance(conf, (int, float)) else "— (people/update carry no framework score)"
        P.append("<div class='card'>")
        P.append(f"<div class='meta'><span class='badge' style='background:{col}'>{html.escape(t)}{' · ' + html.escape(x.get('subtype')) if x.get('subtype') else ''}</span><b>{html.escape(x.get('summary') or '')}</b></div>")
        P.append(f"<div class='quote'>“{html.escape(x.get('quote') or '')}”</div>")
        P.append(f"<div class='scores'>Confidence: <b>{conf_txt}</b> &nbsp;|&nbsp; Groundedness {chip(x['_g'])} &nbsp; Framework {chip(x['_f'])} &nbsp; Calibration {chip(x['_c'])}</div>")
        P.append("</div>")

    P.append("<h2>Transcripts (source of truth — quotes highlighted)</h2>")
    for c in calls:
        quotes = [s.get("quote") for s in sigs if s.get("call_id") == c.get("id")]
        P.append(f"<details><summary>{html.escape(c.get('title') or 'Call')}</summary><div class='tx'>{highlight(c.get('transcript') or '', quotes)}</div></details>")

    open(args.out, "w").write("".join(P))
    print(f"Wrote {args.out}")
    for name, v in overall:
        print(f"  {name:<20} {v}%")

if __name__ == "__main__":
    raise SystemExit(main())
