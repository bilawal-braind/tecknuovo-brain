import { Router } from 'express';
import type { Request } from 'express';
import { q } from './db.js';

export const router = Router();

// ── Per-user data scoping ──────────────────────────────────────────────────
// Returns null  = full access (dev/token mode, or scope='all' / admin).
// Returns [ids] = the account ids this person is allowed to see (scope='own').
// Ownership is DERIVED from the org data (no hand-maintained list): a Client
// Partner / Client Director owns the accounts where they're the client_partner or
// client_director; a Delivery Manager owns the accounts of projects they run -
// matched via people.email = the login.
// Members of the leadership Entra group (IT-managed, like the transcription group)
// get full visibility without any app-side row. Optional: unset = feature off.
const LEADERSHIP_GROUP = (process.env.ENTRA_LEADERSHIP_GROUP_ID || '').toLowerCase();
const inLeadershipGroup = (user?: { groups?: string[] }) =>
  !!LEADERSHIP_GROUP && !!user?.groups?.some((g) => g.toLowerCase() === LEADERSHIP_GROUP);

// Ids arrive from the URL/body; anything that isn't a UUID would otherwise reach
// Postgres and fail as a type error (a 500). Reject it as the bad request it is.
const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// A write is only valid inside the caller's visibility: the signal must exist and,
// for scoped users, sit on one of their accounts. Same rule as the read endpoints.
async function checkSignalWrite(req: Request, signalId: unknown): Promise<{ status: number; error: string } | null> {
  if (!isUuid(signalId)) return { status: 400, error: 'invalid signal_id' };
  const s = await q('SELECT account_id FROM signals WHERE id = $1', [signalId]);
  if (!s.rows.length) return { status: 404, error: 'signal not found' };
  const allowed = await allowedAccounts(req);
  if (allowed !== null && !(s.rows[0].account_id && allowed.includes(String(s.rows[0].account_id)))) {
    return { status: 403, error: 'forbidden' };
  }
  return null;
}

async function allowedAccounts(req: Request): Promise<string[] | null> {
  const user = (req as Request & { user?: { email?: string; groups?: string[] } }).user;
  if (!user?.email) return null; // token/dev mode → full access
  if (inLeadershipGroup(user)) return null; // leadership group → full access
  const email = user.email.toLowerCase();
  const u = await q('SELECT role, scope FROM app_users WHERE lower(email) = lower($1)', [email]);
  const row = u.rows[0];
  if (row && (row.scope === 'all' || row.role === 'admin')) return null; // full access
  const r = await q(
    `SELECT a.id FROM accounts a JOIN people pe ON pe.id IN (a.client_partner, a.client_director) WHERE lower(pe.email) = lower($1)
     UNION
     SELECT pr.account_id FROM projects pr JOIN people pe ON pe.id = pr.delivery_manager WHERE lower(pe.email) = lower($1) AND pr.account_id IS NOT NULL
     UNION
     SELECT pr.account_id FROM projects pr WHERE pr.account_id IS NOT NULL AND pr.delivery_manager_name IS NOT NULL
       AND lower(pr.delivery_manager_name) = (SELECT lower(p2.name) FROM people p2 WHERE lower(p2.email) = lower($1) LIMIT 1)`,
    [email]
  );
  return r.rows.map((x) => String(x.id));
}

// Leadership-only calls (Meesha, 22 Jul): meetings from Katie's diary titled
// Business/Customer Leadership or Leadership Team Meeting are stamped
// visibility='leadership' at ingestion. Only leadership + admin roles (or the
// leadership Entra group) ever receive them, their transcripts or their signals -
// filtered here at the SQL layer, not hidden in the UI.
async function leadershipVisible(req: Request): Promise<boolean> {
  const user = (req as Request & { user?: { email?: string; groups?: string[] } }).user;
  if (!user?.email) return true; // token/dev mode
  if (inLeadershipGroup(user)) return true;
  const u = await q('SELECT role FROM app_users WHERE lower(email) = lower($1)', [user.email]);
  return ['leadership', 'admin'].includes(u.rows[0]?.role);
}

// Who am I - role + scope for the signed-in user, so the dashboard shows the right views.
router.get('/me', async (req, res, next) => {
  try {
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    if (!user?.email) return res.json({ email: null, role: 'admin', scope: 'all', name: 'dev' }); // token mode
    const r = await q('SELECT email, role, scope, name FROM app_users WHERE lower(email) = lower($1)', [user.email]);
    if (r.rows.length) return res.json(r.rows[0]);

    // Leadership Entra group -> full visibility, lands on Leadership (an app_users
    // row still wins above, so individual landing pages can be customised).
    if (inLeadershipGroup(user as { groups?: string[] })) {
      return res.json({ email: user.email, role: 'leadership', scope: 'all', name: user.name || null });
    }

    // Unlisted TN user -> zero-admin self-wiring, then least-privilege default.
    // 1. Bind their login email to their person record (matched by display name,
    //    only when exactly one person has that name), so own-scope filtering works.
    if (user.name) {
      await q(
        `UPDATE people SET email = $1
         WHERE email IS NULL AND lower(name) = lower($2)
           AND (SELECT count(*) FROM people WHERE lower(name) = lower($2)) = 1`,
        [user.email, user.name]
      );
    }
    // 2. Derive their landing dashboard from the org data: Client Partner or
    //    Client Director on any account -> partner view; otherwise delivery.
    const cp = await q(
      `SELECT 1 FROM accounts a JOIN people p ON p.id IN (a.client_partner, a.client_director)
       WHERE lower(p.email) = lower($1) LIMIT 1`,
      [user.email]
    );
    return res.json({ email: user.email, role: cp.rows.length ? 'partner' : 'delivery', scope: 'own', name: user.name || null });
  } catch (e) { next(e); }
});

// Portfolio / list view - accounts with a count of open signals (Leadership, Client Partner, Portfolio).
router.get('/accounts', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE a.id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT a.id, a.name, a.pod,
              cp.name AS client_partner_name,
              cd.name AS client_director_name,
              COALESCE(a.delivery_lead_name,
                       (SELECT w.customer_lead FROM weekly_reports w WHERE w.account_id = a.id AND w.customer_lead IS NOT NULL
                        ORDER BY w.week_ending DESC LIMIT 1)) AS delivery_lead,
              -- Cormac's roll-up (13 Aug): 9-of-10-healthy is NOT at risk. Red needs a
              -- majority of red projects or 2+ open critical signals; one red project,
              -- a majority amber, one critical or 3+ open risks = watching (amber).
              CASE
                WHEN (pj.tot > 0 AND pj.red * 2 >= pj.tot) OR sg.crit >= 2 THEN 'red'
                WHEN pj.red > 0 OR (pj.tot > 0 AND pj.amb * 2 >= pj.tot) OR sg.crit = 1 OR sg.risks >= 3 THEN 'amber'
                ELSE 'green'
              END AS health,
              (SELECT count(*) FROM signals s WHERE s.account_id = a.id AND s.status = 'new') AS open_signals,
              COALESCE((SELECT round(100.0 * (sum(p.sow_value) - sum(p.budget_remaining)) / NULLIF(sum(p.sow_value), 0))
                        FROM projects p WHERE p.account_id = a.id AND p.budget_remaining IS NOT NULL), 0) AS budget_burn_pct,
              COALESCE((SELECT sum(p.budget_remaining) FROM projects p WHERE p.account_id = a.id), 0) AS headroom
       FROM accounts a
       LEFT JOIN people cp ON cp.id = a.client_partner
       LEFT JOIN people cd ON cd.id = a.client_director
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE p2.retired IS NOT TRUE)::int AS tot,
                count(*) FILTER (WHERE p2.retired IS NOT TRUE AND lower(p2.rag) = 'red')::int AS red,
                count(*) FILTER (WHERE p2.retired IS NOT TRUE AND lower(p2.rag) = 'amber')::int AS amb
         FROM projects p2 WHERE p2.account_id = a.id) pj ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE s.details->>'band' = 'Critical')::int AS crit, count(*)::int AS risks
         FROM signals s WHERE s.account_id = a.id AND s.type = 'risk' AND s.status = 'new') sg ON true
       ${filter} ORDER BY a.name`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Account drill-down - the account, its projects/SOWs, and recent signals.
router.get('/accounts/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'invalid account id' });
    const allowed = await allowedAccounts(req);
    if (allowed !== null && !allowed.includes(req.params.id)) return res.status(403).json({ error: 'forbidden' });
    const acc = await q('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!acc.rows.length) return res.status(404).json({ error: 'not found' });
    const projects = await q(
      `SELECT p.id, p.name, p.sow_value, p.sow_status, p.commercial_model, p.start_date, p.end_date,
              p.budget_remaining, (p.sow_value - p.budget_remaining) AS spend, p.delivery_manager_name,
              COALESCE(NULLIF(lower(p.rag), ''),
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' = 'Critical') THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END) AS rag
       FROM projects p WHERE p.account_id = $1 AND p.retired IS NOT TRUE ORDER BY p.sow_value DESC NULLS LAST`,
      [req.params.id]
    );
    const signals = await q(
      `SELECT id, type, subtype, summary, quote, suggested_action, confidence, status, details, project_id, created_at
       FROM signals WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ account: acc.rows[0], projects: projects.rows, signals: signals.rows });
  } catch (e) { next(e); }
});

// Calls (the source Teams calls). Metadata only - transcripts are fetched one at a
// time via /calls/:id/transcript when someone opens one, so this list stays small
// no matter how many months of calls accumulate.
router.get('/calls', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    const conds: string[] = [];
    if (allowed !== null) { params.push(allowed); conds.push(`account_id = ANY($${params.length}::uuid[])`); }
    if (!(await leadershipVisible(req))) conds.push(`COALESCE(visibility, 'all') <> 'leadership'`);
    const filter = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const r = await q(
      `SELECT id, account_id, project_id, title, call_date, source, speaker_stats, visibility,
              duration_seconds, tone, call_type,
              (transcript IS NOT NULL AND transcript <> '') AS has_transcript
       FROM calls ${filter} ORDER BY call_date DESC NULLS LAST LIMIT 500`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// One call's transcript, on demand, with the same account scoping as the list.
router.get('/calls/:id/transcript', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'invalid call id' });
    const r = await q('SELECT id, account_id, transcript, visibility FROM calls WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    const allowed = await allowedAccounts(req);
    if (allowed !== null && !(r.rows[0].account_id && allowed.includes(String(r.rows[0].account_id)))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (r.rows[0].visibility === 'leadership' && !(await leadershipVisible(req))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.json({ id: r.rows[0].id, transcript: r.rows[0].transcript || '' });
  } catch (e) { next(e); }
});

// Flat projects list (the dashboard hydrates its org tree from this + /accounts).
router.get('/projects', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE p.account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT p.id, p.name, p.account_id, p.sow_value, p.sow_status, p.commercial_model, p.start_date, p.end_date,
              p.budget_remaining, (p.sow_value - p.budget_remaining) AS spend, p.delivery_manager_name,
              COALESCE(NULLIF(lower(p.rag), ''),
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' = 'Critical') THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END) AS rag
       FROM projects p ${filter === '' ? "WHERE p.retired IS NOT TRUE" : filter + ' AND p.retired IS NOT TRUE'} ORDER BY p.sow_value DESC NULLS LAST`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Associates (consultants on the ground). No PII (no email/phone).
router.get('/associates', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, name, account_id, project_or_programme, placement_status
       FROM associates ${filter} ORDER BY name`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// QA & Evaluation - transparency metrics + audit trail. Audit is scoped; aggregate counts are not sensitive.
router.get('/qa', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const byType = await q(
      `SELECT type, count(*)::int AS n, round(avg(confidence))::int AS avg_conf
       FROM signals GROUP BY type ORDER BY type`
    );
    const totals = await q(
      `SELECT (SELECT count(*)::int FROM signals) AS signals,
              (SELECT count(*)::int FROM calls)   AS calls,
              (SELECT count(*)::int FROM feedback) AS reviewed,
              (SELECT count(*)::int FROM feedback WHERE verdict = 'correct') AS agreed`
    );
    const params: unknown[] = [];
    const conds: string[] = [];
    if (allowed !== null) { params.push(allowed); conds.push(`s.account_id = ANY($${params.length}::uuid[])`); }
    if (!(await leadershipVisible(req))) conds.push(`COALESCE(s.visibility, 'all') <> 'leadership'`);
    const filter = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const audit = await q(
      `SELECT s.id, s.type, s.summary, s.quote, s.confidence, s.details,
              a.name AS account, p.name AS project, c.title AS call_title, s.created_at,
              (SELECT verdict FROM feedback f WHERE f.signal_id = s.id ORDER BY f.created_at DESC LIMIT 1) AS verdict
       FROM signals s
       LEFT JOIN accounts a ON a.id = s.account_id
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN calls    c ON c.id = s.call_id
       ${filter}
       ORDER BY s.created_at DESC LIMIT 100`,
      params
    );
    res.json({ totals: totals.rows[0], byType: byType.rows, audit: audit.rows });
  } catch (e) { next(e); }
});

// Signals feed - filterable by type/status/account, paginated, scoped to the user.
router.get('/signals', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const where: string[] = [];
    const params: unknown[] = [];
    if (req.query.account_id && !isUuid(req.query.account_id)) return res.status(400).json({ error: 'invalid account_id' });
    for (const [key, col] of [['type', 'type'], ['status', 'status'], ['account_id', 'account_id']] as const) {
      if (req.query[key]) { params.push(req.query[key]); where.push(`s.${col} = $${params.length}`); }
    }
    if (allowed !== null) { params.push(allowed); where.push(`s.account_id = ANY($${params.length}::uuid[])`); }
    if (!(await leadershipVisible(req))) where.push(`COALESCE(s.visibility, 'all') <> 'leadership'`);
    // NaN-proof paging: ?limit=abc must not become a 500.
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    params.push(limit); const lp = params.length;
    params.push(offset); const op = params.length;
    const r = await q(
      `SELECT s.id, s.type, s.subtype, s.summary, s.quote, s.suggested_action, s.confidence, s.status, s.details, s.created_at,
              s.account_id, s.project_id, s.call_id,
              a.name AS account, p.name AS project
       FROM signals s
       LEFT JOIN accounts a ON a.id = s.account_id
       LEFT JOIN projects p ON p.id = s.project_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.created_at DESC LIMIT $${lp} OFFSET $${op}`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Weekly delivery reports - per-project sections parsed from the SharePoint portfolio
// report (workflow 9). Scoped users only see their accounts' sections.
router.get('/weekly-reports', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, week_ending, project_title, account_id, account_name, rag, customer_lead, phase,
              summary, highlights, lowlights, next_week, risks
       FROM weekly_reports ${filter}
       ORDER BY week_ending DESC, project_title LIMIT 400`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// The Monday Risk/Issue/Incident register (read-only mirror, synced daily by the
// reconciliation workflow). OPEN items only - the closed history stays in the DB.
router.get('/risks', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `AND account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, account_id, account_name, name, kind, likelihood, severity, impact_level,
              escalation, status, treatment_plan, responsible, age_days, created_at, last_verified
       FROM risks
       WHERE COALESCE(status, '') NOT IN ('Closed', 'Transferred') ${filter}
       ORDER BY CASE COALESCE(impact_level, '') WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 WHEN 'Low' THEN 2 ELSE 3 END,
                last_verified DESC NULLS LAST
       LIMIT 500`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// CRM mirror - client stakeholders and their buying power (HubSpot, read-only).
// No emails exposed through the API; the dashboard only needs name/title/role.
router.get('/stakeholders', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, name, job_title, buying_role, seniority, account_id, company_name
       FROM stakeholders ${filter} ORDER BY (buying_role IS NULL), name LIMIT 5000`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// CRM mirror - deals (the commercial pipeline per account; HubSpot, read-only).
router.get('/deals', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, name, amount, pipeline, stage, is_open, networks_score, close_date, account_id, company_name
       FROM deals ${filter} ORDER BY is_open DESC, amount DESC NULLS LAST LIMIT 5000`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Human approval on an opportunity -> queue a HubSpot deal push (workflow 11 does the
// actual push). Approval requires the deal's value + close date (entered in the form),
// so a half-empty deal can never be created. approve=false records the decline.
router.post('/hubspot-push', async (req, res, next) => {
  try {
    const { signal_id, approve, given_by, deal_name, amount, close_date } = req.body || {};
    if (!signal_id || typeof approve !== 'boolean') return res.status(400).json({ error: 'signal_id and approve required' });
    const denied = await checkSignalWrite(req, signal_id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    if (approve) {
      if (!(Number(amount) > 0)) return res.status(400).json({ error: 'a deal value (amount) is required' });
      if (!close_date || isNaN(Date.parse(String(close_date)))) return res.status(400).json({ error: 'a close date is required' });
    }
    // The approver is whoever is signed in - a body value can't impersonate anyone.
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const approver = user?.name || user?.email || String(given_by || 'dashboard').slice(0, 120);
    const r = await q(
      `INSERT INTO hubspot_pushes (signal_id, account_id, deal_name, amount, close_date, status, given_by)
       SELECT s.id, s.account_id,
              COALESCE(NULLIF($4, ''), COALESCE(a.name || ' - ', '') || left(COALESCE(s.summary, 'Opportunity'), 120)),
              $5, $6, $2, $3
       FROM signals s LEFT JOIN accounts a ON a.id = s.account_id
       WHERE s.id = $1 AND s.type = 'opportunity'
       ON CONFLICT (signal_id) DO NOTHING
       RETURNING id, status`,
      [signal_id, approve ? 'pending' : 'declined', approver,
       String(deal_name || '').slice(0, 200), approve ? Number(amount) : null, approve ? close_date : null]
    );
    if (!r.rows.length) return res.status(409).json({ error: 'not an opportunity, or already decided' });
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// Team notes on signals - a human log alongside each signal ("caught up with Ryan,
// mitigated, next steps..."). Visible on all dashboards; NOT fed to the classifier.
router.get('/signal-notes', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE n.account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT n.id, n.signal_id, n.note, n.author, n.created_at
       FROM signal_notes n ${filter} ORDER BY n.created_at ASC LIMIT 2000`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Re-file a signal onto the right account - the human correction for a mis-attributed
// signal (multi-client standups, classifier misses). Persisted, audited in the signal's
// details, and recorded as a relabel in feedback so the nightly lessons learn from it.
// The signal keeps its call pointer, so the source transcript stays fully traceable;
// project_id is cleared because the old project belongs to the old account.
router.post('/signals/:id/reassign', async (req, res, next) => {
  try {
    const { account_id } = req.body || {};
    const denied = await checkSignalWrite(req, req.params.id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    if (!isUuid(account_id)) return res.status(400).json({ error: 'invalid account_id' });
    const acc = await q('SELECT id, name FROM accounts WHERE id = $1', [account_id]);
    if (!acc.rows.length) return res.status(404).json({ error: 'account not found' });
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const who = (user?.name || user?.email || 'dashboard').slice(0, 120);
    // $2 must resolve to ONE type - using it as both uuid and text makes Postgres
    // throw "inconsistent types deduced", so it's uuid everywhere and re-cast for audit.
    const r = await q(
      `UPDATE signals SET account_id = $2::uuid, project_id = NULL,
         details = details || jsonb_build_object('reassigned', jsonb_build_object(
           'from', account_id::text, 'to', ($2::uuid)::text, 'to_name', $3::text, 'by', $4::text, 'at', now()::text))
       WHERE id = $1::uuid RETURNING id, account_id`,
      [req.params.id, account_id, acc.rows[0].name, who]
    );
    await q(
      `INSERT INTO feedback (signal_id, account_id, verdict, reason, given_by)
       VALUES ($1, $2, 'relabel', $3, $4)`,
      [req.params.id, account_id, 'account corrected to ' + acc.rows[0].name, who]
    );
    res.json({ id: r.rows[0].id, account_id: r.rows[0].account_id });
  } catch (e) { next(e); }
});

// Human-flagged signal from a transcript line - the quality backstop when the
// classifier misses something. Files to the call's account/project, marked as
// human-sourced in details, and shows on dashboards like any other signal.
router.post('/signals', async (req, res, next) => {
  try {
    const { call_id, type, quote, summary } = req.body || {};
    const types = ['risk', 'opportunity', 'update', 'people'];
    if (!isUuid(call_id)) return res.status(400).json({ error: 'invalid call_id' });
    if (!types.includes(type)) return res.status(400).json({ error: `type must be one of: ${types.join(', ')}` });
    if (!summary || !String(summary).trim()) return res.status(400).json({ error: 'summary required' });
    const call = await q('SELECT id, account_id, project_id, visibility FROM calls WHERE id = $1', [call_id]);
    if (!call.rows.length) return res.status(404).json({ error: 'call not found' });
    const allowed = await allowedAccounts(req);
    if (allowed !== null && !(call.rows[0].account_id && allowed.includes(String(call.rows[0].account_id)))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const who = (user?.name || user?.email || 'dashboard').slice(0, 120);
    const r = await q(
      `INSERT INTO signals (call_id, account_id, project_id, type, subtype, summary, quote, suggested_action, confidence, details, visibility)
       VALUES ($1, $2, $3, $4, 'human-flagged', $5, $6, '', NULL,
               jsonb_build_object('source', 'human', 'flagged_by', $7::text, 'flagged_at', now()::text), $8)
       RETURNING id, created_at`,
      [call_id, call.rows[0].account_id, call.rows[0].project_id, type,
       String(summary).trim().slice(0, 300), String(quote || '').slice(0, 500), who,
       call.rows[0].visibility === 'leadership' ? 'leadership' : 'all']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// Persist a signal's triage status (Actioned / Dismiss / reopen). Previously these
// buttons only changed browser state, so a reviewer's response silently came back
// on refresh - the single most trust-eroding behaviour a review tool can have.
router.post('/signals/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = ['new', 'actioned', 'dismissed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    const denied = await checkSignalWrite(req, req.params.id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const r = await q('UPDATE signals SET status = $2 WHERE id = $1 RETURNING id, status', [req.params.id, status]);
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.post('/signal-notes', async (req, res, next) => {
  try {
    const { signal_id, note, author } = req.body || {};
    if (!signal_id || !note || !String(note).trim()) return res.status(400).json({ error: 'signal_id and note required' });
    const denied = await checkSignalWrite(req, signal_id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const r = await q(
      `INSERT INTO signal_notes (signal_id, account_id, note, author)
       SELECT s.id, s.account_id, $2, $3 FROM signals s WHERE s.id = $1
       RETURNING id, signal_id, note, author, created_at`,
      [signal_id, String(note).trim().slice(0, 4000), (user?.name || user?.email || String(author || 'dashboard')).slice(0, 120)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'signal not found' });
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// ── Leadership OS ──────────────────────────────────────────────────────────
// The latest tnAI brief for an audience (workflow 13 writes them, Mondays 07:50).
router.get('/brief', async (req, res, next) => {
  try {
    const audience = String(req.query.audience || 'leadership').slice(0, 40);
    const days = req.query.days ? Math.min(60, Math.max(1, Number(req.query.days) || 0)) : null;
    const r = days
      ? await q(
          'SELECT id, audience, period_start, period_end, content, created_at FROM briefs WHERE audience = $1 AND (period_end - period_start) = $2 ORDER BY created_at DESC LIMIT 1',
          [audience, days]
        )
      : await q(
          'SELECT id, audience, period_start, period_end, content, created_at FROM briefs WHERE audience = $1 ORDER BY created_at DESC LIMIT 1',
          [audience]
        );
    res.json(r.rows[0] || null);
  } catch (e) { next(e); }
});

// Regenerate the leadership brief over an arbitrary window (the dashboard's
// 7/14/30-day toggle). The API never calls the model itself - it pings workflow
// 13's webhook and waits; n8n owns every model call, as everywhere else.
router.post('/brief/generate', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    if (allowed !== null) return res.status(403).json({ error: 'forbidden' }); // full-visibility users only
    const days = Math.min(60, Math.max(1, Number((req.body || {}).days) || 7));
    const hook = process.env.N8N_BRIEF_WEBHOOK_URL;
    if (!hook) return res.status(503).json({ error: 'brief generator not configured (set N8N_BRIEF_WEBHOOK_URL)' });
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    if (!r.ok) return res.status(502).json({ error: 'generator failed' });
    const b = await q(
      "SELECT id, audience, period_start, period_end, content, created_at FROM briefs WHERE audience = 'leadership' AND (period_end - period_start) = $1 ORDER BY created_at DESC LIMIT 1",
      [days]
    );
    res.json(b.rows[0] || null);
  } catch (e) { next(e); }
});

// Engagement metrics per person, from calls.speaker_stats (who spoke, how much).
// Coverage telemetry for the Ops OS view - calls attended, accounts covered,
// signals surfaced from their calls, share of the recorded airtime.
router.get('/people-metrics', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 120);
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [String(days)];
    let scope = '';
    if (allowed !== null) { params.push(allowed); scope = ` AND account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `WITH recent AS (
         SELECT id, account_id, speaker_stats FROM calls
         WHERE call_date > now() - ($1 || ' days')::interval AND speaker_stats IS NOT NULL${scope}
       ),
       per AS (
         SELECT key AS name, count(*) AS calls, count(DISTINCT account_id) AS accounts, sum(value::int) AS lines
         FROM recent, jsonb_each_text(speaker_stats) GROUP BY key
       ),
       tot AS (SELECT COALESCE(sum(value::int), 0) AS all_lines FROM recent, jsonb_each_text(speaker_stats)),
       sigs AS (
         SELECT j.key AS name, count(s.id) AS signals
         FROM recent r
         JOIN signals s ON s.call_id = r.id
         CROSS JOIN LATERAL jsonb_each_text(r.speaker_stats) j
         GROUP BY j.key
       )
       SELECT p.name, p.calls::int, p.accounts::int,
              COALESCE(sg.signals, 0)::int AS signals,
              COALESCE(round(100.0 * p.lines / NULLIF(t.all_lines, 0)), 0)::int AS talk_share
       FROM per p CROSS JOIN tot t
       LEFT JOIN sigs sg ON sg.name = p.name
       ORDER BY p.calls DESC, p.name LIMIT 200`,
      params
    );

    // When the transcription security group is synced (watchlist, workflow 6),
    // THAT is the team Katie sees: every member, with their stats matched from
    // the analysed calls - zeros included ("no analysed calls yet" is
    // information, not noise). Names arrive in different shapes ("Battersby,
    // Kiera (TN-...)" vs "Kiera Battersby"), so match on a normalised form.
    const wl = await q('SELECT display_name FROM watchlist WHERE active AND display_name IS NOT NULL');
    if (wl.rows.length) {
      const norm = (n: unknown) => {
        const noParen = String(n ?? '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
        const flipped = noParen.includes(',') ? noParen.split(',').map((x) => x.trim()).reverse().join(' ') : noParen;
        return flipped.toLowerCase().replace(/[^a-z0-9]/g, '');
      };
      const stats = new Map<string, { calls: number; accounts: number; signals: number; talk_share: number }>();
      for (const row of r.rows) {
        const k = norm(row.name);
        const e = stats.get(k);
        if (e) { e.calls += row.calls; e.accounts = Math.max(e.accounts, row.accounts); e.signals += row.signals; e.talk_share += row.talk_share; }
        else stats.set(k, { calls: row.calls, accounts: row.accounts, signals: row.signals, talk_share: row.talk_share });
      }
      const team = wl.rows
        .map((w) => {
          const e = stats.get(norm(w.display_name));
          return { name: w.display_name as string, calls: e?.calls ?? 0, accounts: e?.accounts ?? 0, signals: e?.signals ?? 0, talk_share: e?.talk_share ?? 0, in_team: true };
        })
        .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
      return res.json(team);
    }

    res.json(r.rows);
  } catch (e) { next(e); }
});

// The single write path - Observability corrections feed the learning loop.
router.post('/feedback', async (req, res, next) => {
  try {
    const { signal_id, verdict, correct_type, reason, given_by } = req.body || {};
    if (!signal_id || !verdict) return res.status(400).json({ error: 'signal_id and verdict required' });
    if (!['correct', 'incorrect', 'relabel'].includes(String(verdict))) return res.status(400).json({ error: 'invalid verdict' });
    const denied = await checkSignalWrite(req, signal_id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const r = await q(
      `INSERT INTO feedback (signal_id, account_id, verdict, correct_type, reason, given_by)
       SELECT $1, s.account_id, $2, $3, $4, $5 FROM signals s WHERE s.id = $1 RETURNING id`,
      [signal_id, verdict, correct_type ? String(correct_type).slice(0, 40) : null,
       reason ? String(reason).slice(0, 2000) : null,
       user?.name || user?.email || (given_by ? String(given_by).slice(0, 120) : null)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'signal not found' });
    // Meesha (12 Aug): marking a signal INCORRECT removes it from every dashboard
    // immediately - the feedback row still teaches the classifier.
    if (verdict === 'incorrect') await q(`UPDATE signals SET status='dismissed' WHERE id = $1`, [signal_id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});

// Undo an "incorrect" verdict: retract the feedback row (so the learning loop
// never trains on a retracted judgment) and put the signal back in the queue.
// Only acts when the LATEST feedback on the signal is 'incorrect' - a plain
// Dismiss/Actioned undo passes through harmlessly.
router.post('/feedback/undo', async (req, res, next) => {
  try {
    const { signal_id } = req.body || {};
    const denied = await checkSignalWrite(req, signal_id);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const del = await q(
      `DELETE FROM feedback WHERE id = (
         SELECT id FROM feedback WHERE signal_id = $1 ORDER BY created_at DESC LIMIT 1
       ) AND verdict = 'incorrect' RETURNING id`, [signal_id]);
    await q(`UPDATE signals SET status='new' WHERE id = $1 AND status = 'dismissed'`, [signal_id]);
    res.json({ retracted: del.rowCount > 0 });
  } catch (e) { next(e); }
});

// ── The learning loop, made visible (Cormac, 17 Aug) ────────────────────────
// Everything the feedback system knows: who reviewed what, which accounts get
// the most correction, the weekly wrong-rate curve, and the lessons the brain
// wrote from it all. Read-only aggregation - the Learning tab and the weekly
// digest both draw from here.
router.get('/learning', async (req, res, next) => {
  try {
    // Open to every signed-in user - reviewers (Kiera, Meesha) must see their own
    // feedback land. Only the signal text itself is visibility-filtered below;
    // editing lessons stays leadership-gated (PUT /learning/lesson).
    const leader = await leadershipVisible(req);
    const weekly = (await q(
      `SELECT to_char(date_trunc('week', created_at), 'DD Mon') AS week,
              count(*)::int AS total,
              count(*) FILTER (WHERE verdict = 'incorrect')::int AS incorrect,
              count(*) FILTER (WHERE verdict = 'relabel')::int AS relabel,
              count(reason)::int AS with_reason
       FROM feedback GROUP BY date_trunc('week', created_at) ORDER BY date_trunc('week', created_at)`)).rows;
    const reviewers = (await q(
      `SELECT COALESCE(given_by, 'unknown') AS name, count(*)::int AS total,
              count(reason)::int AS with_reason,
              count(*) FILTER (WHERE verdict = 'correct')::int AS correct,
              count(*) FILTER (WHERE verdict = 'incorrect')::int AS incorrect,
              count(*) FILTER (WHERE verdict = 'relabel')::int AS relabel
       FROM feedback GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)).rows;
    const accounts = (await q(
      `SELECT a.name, count(*)::int AS total,
              count(*) FILTER (WHERE f.verdict = 'incorrect')::int AS incorrect
       FROM feedback f JOIN accounts a ON a.id = f.account_id
       GROUP BY a.name ORDER BY 2 DESC LIMIT 12`)).rows;
    const recent = (await q(
      `SELECT f.verdict, f.correct_type, f.reason, COALESCE(f.given_by,'unknown') AS given_by,
              f.created_at, a.name AS account, s.summary,
              s.type AS signal_type, s.subtype, s.quote, s.suggested_action,
              s.details, s.created_at AS signal_at, p.name AS project
       FROM feedback f
       LEFT JOIN accounts a ON a.id = f.account_id
       LEFT JOIN signals s ON s.id = f.signal_id
       LEFT JOIN projects p ON p.id = s.project_id
       ${leader ? '' : "WHERE s.id IS NULL OR COALESCE(s.visibility,'all') <> 'leadership'"}
       ORDER BY f.created_at DESC LIMIT 400`)).rows;
    const lessons = (await q(
      `SELECT a.id AS account_id, a.name AS account, a.feedback_summary AS summary,
              a.feedback_summary_manual AS manual,
              (SELECT count(*)::int FROM feedback f WHERE f.account_id = a.id) AS feedback_count
       FROM accounts a WHERE a.feedback_summary IS NOT NULL ORDER BY 4 DESC`)).rows;
    const totals = (await q(
      `SELECT count(*)::int AS total, count(reason)::int AS with_reason,
              count(DISTINCT signal_id)::int AS signals_reviewed,
              (SELECT count(*)::int FROM signals) AS signals_total
       FROM feedback`)).rows[0];
    res.json({ weekly, reviewers, accounts, recent, lessons, totals });
  } catch (e) { next(e); }
});

// Edit an account's lesson by hand (17 Aug): the classifier uses this text on
// every future call for the account. A manual edit pauses the auto-learner for
// that account (workflow 3 skips it) until auto-learning is resumed.
router.put('/learning/lesson', async (req, res, next) => {
  try {
    if (!(await leadershipVisible(req))) return res.status(403).json({ error: 'forbidden' });
    const { account_id, summary, resume } = (req.body ?? {}) as Record<string, unknown>;
    if (!isUuid(account_id)) return res.status(400).json({ error: 'invalid account_id' });
    if (resume === true) {
      await q(`UPDATE accounts SET feedback_summary_manual = false WHERE id = $1`, [account_id]);
      return res.json({ manual: false });
    }
    const text = String(summary ?? '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'summary required' });
    const r = await q(`UPDATE accounts SET feedback_summary = $2, feedback_summary_manual = true WHERE id = $1 RETURNING name`, [account_id, text]);
    if (!r.rows.length) return res.status(404).json({ error: 'account not found' });
    res.json({ manual: true });
  } catch (e) { next(e); }
});

// ── Push a risk to the Monday risk register (Meesha, 13 Aug) ────────────────
// The mirror of the HubSpot opportunity push: a deliberate human click creates
// the item on the Risks, Issues & Incidents board (1583443098, Incoming group).
// Monday is the system of record; this is the system of intelligence.
router.post('/signals/:id/push-register', async (req, res, next) => {
  try {
    const signalId = req.params.id;
    const denied = await checkSignalWrite(req, signalId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    const token = process.env.MONDAY_API_TOKEN;
    if (!token) return res.status(503).json({ error: 'Monday token not configured' });
    const r = await q(
      `SELECT s.type, s.summary, s.quote, s.suggested_action, s.details, a.name AS account
       FROM signals s LEFT JOIN accounts a ON a.id = s.account_id WHERE s.id = $1`, [signalId]);
    const sig = r.rows[0];
    if (!sig) return res.status(404).json({ error: 'signal not found' });
    if (!String(sig.type).toLowerCase().includes('risk')) return res.status(400).json({ error: 'only risks push to the register' });
    const det = (sig.details && typeof sig.details === 'object' ? sig.details : {}) as Record<string, unknown>;
    if (det.register_item_id) return res.json({ item_id: String(det.register_item_id), already: true });

    // 5x5 v1.1 bands -> the register's three impact labels. 'Low-Medium' (4-7,
    // tolerable per the framework) must land Low, not Medium.
    const band = String(det.band ?? '').toLowerCase();
    const impact = band.includes('critical') || band.includes('high') ? 'High'
      : band.includes('low') ? 'Low'
      : band.includes('medium') ? 'Medium' : 'Low';
    const desc = [sig.summary, sig.quote ? `Heard on a call: "${sig.quote}"` : '', 'Flagged by tnAI (the Second Brain).'].filter(Boolean).join('\n\n');
    const name = String(sig.summary || 'Risk from tnAI').slice(0, 120);

    const monday = async (cols: Record<string, unknown>) => {
      const body = {
        query: `mutation ($name: String!, $cols: JSON!) {
          create_item(board_id: 1583443098, group_id: "group_mkq8tm9b", item_name: $name, column_values: $cols, create_labels_if_missing: true) { id }
        }`,
        variables: { name, cols: JSON.stringify(cols) },
      };
      const resp = await fetch('https://api.monday.com/v2', {
        method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
        body: JSON.stringify(body),
      });
      const j = (await resp.json()) as { data?: { create_item?: { id?: string } }; errors?: unknown };
      if (j.errors || !j.data?.create_item?.id) throw new Error(JSON.stringify(j.errors ?? j).slice(0, 300));
      return j.data.create_item.id;
    };

    let itemId: string;
    const fullCols: Record<string, unknown> = {
      single_select__1: { label: 'Risk' },
      long_text32__1: { text: desc.slice(0, 2000) },
      status_17: { label: impact },
      reference: `tnAI ${signalId}`,
    };
    if (sig.suggested_action) fullCols.long_text__1 = { text: String(sig.suggested_action).slice(0, 2000) };
    if (sig.account) fullCols.dropdown = { labels: [String(sig.account)] };
    try {
      itemId = await monday(fullCols);
    } catch {
      // a label the board doesn't know must not block the push - retry minimal
      itemId = await monday({ long_text32__1: { text: desc.slice(0, 2000) }, reference: `tnAI ${signalId}` });
    }
    await q(`UPDATE signals SET details = COALESCE(details,'{}'::jsonb) || jsonb_build_object('register_item_id', $2::text, 'register_pushed_at', now()::text) WHERE id = $1`, [signalId, itemId]);
    res.status(201).json({ item_id: itemId });
  } catch (e) { next(e); }
});

// ── tnAI · Ask the brain (V1 beta) ───────────────────────────────────────────
// A deterministic retrieval engine over the SCOPED data (same account + leadership
// filters as every endpoint) with an optional LLM phrasing pass: when
// AZURE_OPENAI_ENDPOINT/KEY are set, gpt-4o-mini turns the retrieved facts into a
// conversational answer; without them the endpoint still answers from templates -
// the chat never depends on the model being reachable. Charts are returned as
// simple {kind,title,data} payloads the dashboard renders itself.
async function llmPhrase(question: string, facts: unknown): Promise<string | null> {
  // First choice: workflow 20 in n8n (webhook -> AI Agent on the client's own
  // Azure OpenAI credential, like every other automation). Falls back to the
  // direct Azure call, then to the deterministic templates - the chat never
  // depends on any single hop being up.
  const askUrl = process.env.N8N_ASK_URL || 'http://localhost:5678/webhook/tnai-ask';
  try {
    const ctl0 = new AbortController();
    const t0 = setTimeout(() => ctl0.abort(), 25000);
    const prompt = 'You are tnAI, the assistant inside the Tecknuovo Second Brain dashboard. Answer the question using ONLY the facts JSON provided - never invent names, numbers or events. Be brief (2-5 sentences), plain UK business English, no markdown headings, no bullet spam. Never use em dashes. If the facts are empty, say so plainly and suggest what to ask instead.\n\nQUESTION: ' + question + '\n\nFACTS:\n' + JSON.stringify(facts).slice(0, 9000);
    const r0 = await fetch(askUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), signal: ctl0.signal,
    });
    clearTimeout(t0);
    if (r0.ok) {
      const j0 = (await r0.json()) as { answer?: string };
      const a = typeof j0.answer === 'string' ? j0.answer.trim() : '';
      if (a) return a.slice(0, 2000);
    }
  } catch { /* fall through to direct Azure */ }
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
  const key = process.env.AZURE_OPENAI_KEY;
  const dep = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
  if (!endpoint || !key) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(`${endpoint}/openai/deployments/${dep}/chat/completions?api-version=2024-06-01`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        temperature: 0.2, max_tokens: 350,
        messages: [
          { role: 'system', content: 'You are tnAI, the assistant inside the Tecknuovo Second Brain dashboard. Answer the question using ONLY the facts JSON provided - never invent names, numbers or events. Be brief (2-5 sentences), plain UK English, no markdown headings, no bullet spam. If the facts are empty, say so plainly and suggest what to ask instead.' },
          { role: 'user', content: `QUESTION: ${question}\n\nFACTS:\n${JSON.stringify(facts).slice(0, 9000)}` },
        ],
      }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

router.post('/ask', async (req, res, next) => {
  try {
    const question = String((req.body as Record<string, unknown>)?.question ?? '').trim().slice(0, 400);
    if (!question) return res.status(400).json({ error: 'question required' });
    const qs = question.toLowerCase();
    const allowed = await allowedAccounts(req);
    const leader = await leadershipVisible(req);

    // window: "today" 1d · "week" 7d · "month" 30d · default 14d
    const days = /today|24 hours/.test(qs) ? 1 : /month|30 day/.test(qs) ? 30 : /week/.test(qs) ? 7 : 14;

    // accounts mentioned by name
    const accParams: unknown[] = [];
    let accScope = '';
    if (allowed !== null) { accParams.push(allowed); accScope = ` WHERE id = ANY($${accParams.length}::uuid[])`; }
    const accRows = (await q(`SELECT id, name, pod FROM accounts${accScope}`, accParams)).rows as { id: string; name: string; pod: string | null }[];
    const mentioned = accRows.filter((a) => a.name.length >= 3 && qs.includes(a.name.toLowerCase()));
    const accIds = mentioned.length ? mentioned.map((a) => a.id) : allowed;

    const wantsRisk = /risk|issue|problem|concern|escalat|worried|wrong/.test(qs);
    const wantsOpp = /opportun|upsell|grow|pipeline|deal|revenue|expand/.test(qs);
    const wantsPeople = /people|team|resourc|morale|leav|attrition|consultant|associate/.test(qs);
    const wantsCalls = /call|meeting|transcri|conversation|activity/.test(qs);
    const wantsRegister = /register|raid|log/.test(qs);
    const wantsHealth = /health|rag|status|at risk|how is|how are|overview|summar|going/.test(qs);
    const typeFilter = wantsRisk && !wantsOpp ? "AND s.type = 'risk'" : wantsOpp && !wantsRisk ? "AND s.type = 'opportunity'" : wantsPeople ? "AND s.type = 'people'" : '';

    const p: unknown[] = [String(days)];
    let scope = '';
    if (accIds !== null) { p.push(accIds); scope = ` AND s.account_id = ANY($${p.length}::uuid[])`; }
    const vis = leader ? '' : " AND COALESCE(s.visibility,'all') <> 'leadership'";

    const sigRows = (await q(
      `SELECT s.id, s.type, s.summary, s.status, s.details->>'band' AS band, a.name AS account, s.account_id, s.project_id, s.created_at::date AS d
       FROM signals s LEFT JOIN accounts a ON a.id = s.account_id
       WHERE s.created_at > now() - ($1 || ' days')::interval ${typeFilter}${scope}${vis}
       ORDER BY (s.details->>'band') = 'Critical' DESC, s.created_at DESC LIMIT 40`, p)).rows;

    const callRows = (await q(
      `SELECT c.id, c.title, c.call_date::date AS d, a.name AS account
       FROM calls c LEFT JOIN accounts a ON a.id = c.account_id
       WHERE c.call_date > now() - ($1 || ' days')::interval${accIds !== null ? ` AND c.account_id = ANY($2::uuid[])` : ''}${leader ? '' : " AND COALESCE(c.visibility,'all') <> 'leadership'"}
       ORDER BY c.call_date DESC LIMIT 30`, accIds !== null ? [String(days), accIds] : [String(days)])).rows;

    const regRows = wantsRegister || wantsRisk
      ? (await q(`SELECT r.name, r.impact_level, r.escalation, r.status, a.name AS account FROM risks r LEFT JOIN accounts a ON a.id = r.account_id
                  WHERE COALESCE(r.status,'') NOT ILIKE '%closed%'${accIds !== null ? ' AND r.account_id = ANY($1::uuid[])' : ''} LIMIT 20`,
                 accIds !== null ? [accIds] : [])).rows
      : [];

    // chart: per-account signal counts; calls per day for call questions; per-day
    // line when the question is about ONE account or a trend (so single-account
    // questions still get a visual - 12 Aug feedback).
    let chart: { kind: string; title: string; data: { label: string; value: number }[] } | null = null;
    const dayLine = (rows: { d: string }[], title: string) => {
      const byDay = new Map<string, number>();
      for (const r of rows) { const k = String(r.d).slice(5, 10); byDay.set(k, (byDay.get(k) || 0) + 1); }
      if (byDay.size > 1) return { kind: 'line', title, data: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([label, value]) => ({ label, value })) };
      return null;
    };
    if (wantsCalls) {
      chart = dayLine(callRows as { d: string }[], `Calls per day · last ${days} days`);
    } else if (/trend|over time|per day|daily|momentum|how are|how is/.test(qs) && sigRows.length) {
      chart = dayLine(sigRows as { d: string }[], `Signals per day${mentioned.length === 1 ? ` · ${mentioned[0].name}` : ''} · last ${days} days`);
    }
    if (!chart && sigRows.length) {
      const byAcc = new Map<string, number>();
      for (const s of sigRows as { account: string | null }[]) if (s.account) byAcc.set(s.account, (byAcc.get(s.account) || 0) + 1);
      if (byAcc.size > 1) chart = { kind: 'bar', title: `${typeFilter ? (wantsRisk ? 'Risks' : wantsOpp ? 'Opportunities' : 'People signals') : 'Signals'} by account · last ${days} days`, data: [...byAcc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value })) };
      else chart = dayLine(sigRows as { d: string }[], `Signals per day${mentioned.length === 1 ? ` · ${mentioned[0].name}` : ''} · last ${days} days`);
    }

    const facts = {
      window_days: days,
      accounts_in_scope: mentioned.length ? mentioned.map((a) => a.name) : 'all visible accounts',
      signals: (sigRows as Record<string, unknown>[]).slice(0, 15).map((s) => ({ type: s.type, band: s.band, account: s.account, summary: s.summary, status: s.status })),
      signal_count: sigRows.length,
      calls: (callRows as Record<string, unknown>[]).slice(0, 8).map((c) => ({ title: c.title, account: c.account, date: c.d })),
      call_count: callRows.length,
      register_open_items: regRows,
      health: wantsHealth ? accRows.slice(0, 25).map((a) => a.name) : undefined,
    };

    // deterministic fallback answer (also the no-LLM answer)
    const top = (sigRows as { type: string; summary: string; account: string | null }[]).slice(0, 3);
    let fallback = `In the last ${days} days I can see ${sigRows.length} signal${sigRows.length !== 1 ? 's' : ''} and ${callRows.length} call${callRows.length !== 1 ? 's' : ''}${mentioned.length ? ` on ${mentioned.map((a) => a.name).join(', ')}` : ' across your accounts'}.`;
    if (top.length) fallback += ` Top items: ${top.map((s) => `${s.account ? s.account + ' - ' : ''}${s.summary}`).join(' · ')}`;
    if (!sigRows.length && !callRows.length) fallback = `Nothing analysed in the last ${days} days${mentioned.length ? ` for ${mentioned.map((a) => a.name).join(', ')}` : ''} - try a longer window like "this month".`;

    const llmAnswer = await llmPhrase(question, facts);
    const items = (sigRows as Record<string, unknown>[]).slice(0, 6).map((s) => ({ id: s.id, type: s.type, summary: s.summary, account: s.account, account_id: s.account_id, project_id: s.project_id }));
    res.json({ answer: llmAnswer || fallback, llm: !!llmAnswer, chart, items, window_days: days });
  } catch (e) { next(e); }
});

// ── Provenance feedback ("this looks wrong" from the source-trace sidebar) ───
// Stored in Postgres (system of record). If BRAIND_SLACK_WEBHOOK is set, a
// content-light copy is forwarded to BraindAI's internal Slack: the item KIND,
// its short label and the user's own words - never transcripts or signal bodies.
router.post('/source-feedback', async (req, res, next) => {
  try {
    const { kind, ref_id, ref_label, note } = (req.body ?? {}) as Record<string, unknown>;
    const k = String(kind ?? '').toLowerCase();
    if (!['signal', 'call', 'account', 'project'].includes(k)) return res.status(400).json({ error: 'invalid kind' });
    const n = String(note ?? '').trim().slice(0, 1000);
    if (!n) return res.status(400).json({ error: 'note required' });
    const label = String(ref_label ?? '').slice(0, 160);
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const who = user?.name || user?.email || 'dashboard user (dev mode)';
    const r = await q(
      'INSERT INTO source_feedback (kind, ref_id, ref_label, note, author) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [k, String(ref_id ?? '').slice(0, 80), label, n, (user?.email ?? '').toLowerCase()]
    );
    const hook = process.env.BRAIND_SLACK_WEBHOOK;
    if (hook) {
      fetch(hook, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:triangular_flag_on_post: TN dashboard feedback · ${k}${label ? ` · ${label}` : ''}\n:bust_in_silhouette: raised by ${who}\n> ${n}` }),
      }).catch(() => {});
    }
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});

// ── Personal to-do list (Kiera's "add to list" on suggested actions) ─────────
// Per-user by login email; token/dev mode has no email and shares the '' user.
const todoUser = (req: Request) => ((req as Request & { user?: { email?: string } }).user?.email || '').toLowerCase();

router.get('/todos', async (req, res, next) => {
  try {
    const r = await q(
      `SELECT t.id, t.signal_id, t.title, t.account_id, a.name AS account_name, t.done, t.created_at
       FROM user_todos t LEFT JOIN accounts a ON a.id = t.account_id
       WHERE lower(t.user_email) = $1 ORDER BY t.done, t.created_at DESC LIMIT 200`,
      [todoUser(req)]
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.post('/todos', async (req, res, next) => {
  try {
    const { signal_id, title, account_id } = (req.body ?? {}) as { signal_id?: unknown; title?: unknown; account_id?: unknown };
    const t = String(title ?? '').trim().slice(0, 300);
    if (!t) return res.status(400).json({ error: 'title required' });
    if (signal_id != null && !isUuid(signal_id)) return res.status(400).json({ error: 'invalid signal_id' });
    if (account_id != null && !isUuid(account_id)) return res.status(400).json({ error: 'invalid account_id' });
    // Same signal saved twice = the same to-do; hand back the existing row.
    if (signal_id) {
      const dup = await q('SELECT id, created_at FROM user_todos WHERE lower(user_email) = $1 AND signal_id = $2', [todoUser(req), signal_id]);
      if (dup.rows.length) return res.json(dup.rows[0]);
    }
    const r = await q(
      `INSERT INTO user_todos (user_email, signal_id, title, account_id)
       VALUES ($1, $2::uuid, $3, $4::uuid) RETURNING id, created_at`,
      [todoUser(req), (signal_id as string) ?? null, t, (account_id as string) ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// Toggle done / remove. Only the owner's rows are reachable.
router.post('/todos/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
    const { done, remove, title } = (req.body ?? {}) as { done?: unknown; remove?: unknown; title?: unknown };
    if (remove === true) {
      await q('DELETE FROM user_todos WHERE id = $1 AND lower(user_email) = $2', [req.params.id, todoUser(req)]);
      return res.json({ id: req.params.id, removed: true });
    }
    // Rename in place (the list is the user's own - fully editable).
    if (typeof title === 'string' && title.trim()) {
      const r = await q(
        'UPDATE user_todos SET title = $3 WHERE id = $1 AND lower(user_email) = $2 RETURNING id, title',
        [req.params.id, todoUser(req), title.trim().slice(0, 300)]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'not found' });
      return res.json(r.rows[0]);
    }
    const r = await q(
      `UPDATE user_todos SET done = $3, done_at = CASE WHEN $3 THEN now() ELSE NULL END
       WHERE id = $1 AND lower(user_email) = $2 RETURNING id, done`,
      [req.params.id, todoUser(req), done === true]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});
