#!/usr/bin/env python3
"""Generate realistic 15-20 min call transcripts around the planted signals in specs.py,
using your Azure gpt-4o-mini. Writes:
  - qa/goldens/transcripts/<id>.txt   (one transcript per scenario)
  - qa/goldens/inbox_seed.sql         (drops them into the inbox → runs through the pipeline)
  - qa/goldens/cleanup.sql            (removes all golden test data from the live DB afterwards)

Ground truth stays in specs.py — the transcripts just embed each planted/trap line verbatim.

Env (same Azure creds as the pipeline):
  export AZURE_OPENAI_API_KEY=...  AZURE_OPENAI_ENDPOINT=https://<res>.openai.azure.com
  export AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

Run:
  python qa/goldens/generate.py
"""
import os, sys
from specs import SPECS

def client():
    key, ep = os.environ.get("AZURE_OPENAI_API_KEY"), os.environ.get("AZURE_OPENAI_ENDPOINT")
    if not key or not ep:
        print("Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT first.", file=sys.stderr); sys.exit(1)
    from openai import AzureOpenAI
    return AzureOpenAI(api_key=key, azure_endpoint=ep, api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")), os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

def esc(s): return str(s).replace("'", "''")

def prompt_for(spec):
    lines = [p["line"] for p in spec["planted"]] + [t["line"] for t in spec["traps"]]
    must = "\n".join(f'  - "{l}"' for l in lines)

    # Ground the call in the real Monday project state, when provided.
    ctx = spec.get("context") or {}
    ctx_block = ""
    if ctx:
        facts = "\n".join(f"  - {k}: {v}" for k, v in ctx.items() if v not in (None, ""))
        ctx_block = ("\nGROUND THE CALL IN THIS REAL PROJECT STATE — reference these real details "
                     "naturally through the conversation (status, value, dates, stage):\n" + facts + "\n")
    dm = spec.get("dm")
    dm_block = (f'\nThe real Tecknuovo delivery manager on this account is "{dm}" — include them as a '
                f"speaker.\n" if dm else "")

    return f"""Write a realistic Microsoft Teams call transcript for a UK digital-delivery consultancy (Tecknuovo).

Call: {spec['call_type']} for the account "{spec['account']}", project "{spec['project']}".
Length: a natural 15-20 minute call — roughly 2000-2600 words. Multiple named speakers
(Tecknuovo delivery/commercial people + client stakeholders), realistic back-and-forth, an
agenda appropriate to a {spec['call_type']}, hesitations and small talk. British English.
{ctx_block}{dm_block}
CRITICAL: the following sentences MUST each appear in the transcript, spoken naturally and
VERBATIM (word for word) by whichever speaker fits. Weave them in; don't list them:
{must}

Output ONLY the transcript text (start with a title line, date, and attendees). No commentary.
This is SAMPLE data for testing — keep CLIENT stakeholder names fictional (real Tecknuovo staff names are fine)."""

def main():
    c, dep = client()
    here = os.path.dirname(__file__)
    tdir = os.path.join(here, "transcripts"); os.makedirs(tdir, exist_ok=True)
    inserts, cleanup_keys = [], []
    for i, spec in enumerate(SPECS):
        print(f"generating {i+1}/{len(SPECS)}: {spec['id']} ({spec['account']})...")
        r = c.chat.completions.create(model=dep, temperature=0.7,
            messages=[{"role": "user", "content": prompt_for(spec)}])
        tx = r.choices[0].message.content.strip()
        open(os.path.join(tdir, spec["id"] + ".txt"), "w").write(tx)
        title = f"{spec['account']} — {spec['project']} — {spec['call_type']} (golden test)"
        payload = ("jsonb_build_object('account','%s','title','%s','dedup_key','%s','transcript','%s')"
                   % (esc(spec["account"]), esc(title), esc(spec["id"]), esc(tx)))
        inserts.append("  ('teams','%s',%s,'pending')" % (esc(spec["id"]), payload))
        cleanup_keys.append(spec["id"])

    seed = ("-- Golden test calls → inbox (run, then execute the Main Pipeline to classify them).\n"
            "INSERT INTO inbox (source, dedup_key, payload, status) VALUES\n"
            + ",\n".join(inserts) + "\nON CONFLICT (dedup_key) DO NOTHING;\n")
    open(os.path.join(here, "inbox_seed.sql"), "w").write(seed)

    keys = ",".join("'%s'" % k for k in cleanup_keys)
    cleanup = (f"""-- Remove ALL golden test data from the live DB (the public demo is snapshot-based, unaffected).
DELETE FROM signals WHERE call_id IN (SELECT id FROM calls WHERE dedup_key IN ({keys}));
DELETE FROM calls  WHERE dedup_key IN ({keys});
DELETE FROM inbox  WHERE dedup_key IN ({keys});
-- Optional: remove test-only accounts that now have no signals (keeps the tree tidy):
-- DELETE FROM projects WHERE account_id IN (SELECT id FROM accounts a WHERE NOT EXISTS (SELECT 1 FROM signals s WHERE s.account_id=a.id) AND a.name <> 'HMRC');
-- DELETE FROM accounts WHERE name <> 'HMRC' AND NOT EXISTS (SELECT 1 FROM signals s WHERE s.account_id = accounts.id);
""")
    open(os.path.join(here, "cleanup.sql"), "w").write(cleanup)
    print(f"\n✓ {len(SPECS)} transcripts → {tdir}")
    print(f"✓ inbox_seed.sql and cleanup.sql written to {here}")

if __name__ == "__main__":
    raise SystemExit(main())
