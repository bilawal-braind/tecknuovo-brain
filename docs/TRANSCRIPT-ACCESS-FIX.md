# Teams transcript access — the real blocker (and the one fix TN must apply)

## What's happening
Every Graph call for a Teams transcript returns:

> **403 Forbidden — "Graph API access to transcripts is disabled for this tenant."**
> (`GraphAccessToTranscriptsDisabled`)

This is **not** a credential, app-permission, n8n, or code problem. Verified on the
VM: the Braind app token is valid and carries the correct role
`OnlineMeetingTranscript.Read.All` — Graph still refuses at the **tenant level**.

## Why now
Microsoft introduced a new tenant control, **enforced from 31 July 2026**: Graph API
access to Teams transcripts is **off by default** and must be switched on by a Teams
admin. Tenants that hadn't enabled it started getting this 403 immediately after that
date. That is why the pipeline pulls **zero** Teams calls even though it was "revived"
— the watcher runs green but every transcript fetch is silently blocked.

## The fix (Tecknuovo Teams / Global admin — ~2 minutes)
**Teams Admin Center:** Meetings → Meeting settings → **Transcript API access** →
turn **Microsoft Graph access = On**.

**or PowerShell** (Teams PowerShell module, admin):
```powershell
Set-CsTeamsMeetingConfiguration -Identity Global \
  -EnableGraphTranscriptAccess $true \
  -EnableAttributedTranscripts $true
```
`EnableAttributedTranscripts $true` is important for us: it keeps **speaker names**
in the VTT, which is what powers "who said what" and speaker stats on the dashboard.
Without it, transcripts come back but with no attribution.

Changes can take a little time to propagate across the tenant.

## After TN flips it
1. BraindAI re-runs the backfill dry run (already built and armed): fetches every
   transcribed call from 22 Jul → now and prints the count, **writing nothing**.
2. On review, run it for real → rows land in `inbox` → workflow 1's sweep classifies
   them automatically. No n8n change involved.

## One open question (we'll confirm by testing the moment it's on)
Microsoft doesn't document whether transcripts *created during the disabled window*
become readable again once the setting is re-enabled. The transcripts still exist in
Teams (only the API gate was closed, not the data), so we expect them to return — but
we'll know for certain the second TN flips the toggle and we re-run the dry run.

## Appointment of blame, for the record
- 22 Jul 2026: pipeline stopped (BraindAI account lost TN sign-in).
- 31 Jul 2026: even a fully revived pipeline can't read transcripts — the new MS
  tenant control took effect. Two separate causes; this doc is about the second.
