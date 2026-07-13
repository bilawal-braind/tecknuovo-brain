import { Router } from 'express';
import type { Request } from 'express';
import { q } from './db.js';

export const router = Router();

// ── Per-user data scoping ──────────────────────────────────────────────────
// Returns null  = full access (dev/token mode, or scope='all' / admin).
// Returns [ids] = the account ids this person is allowed to see (scope='own').
// Ownership is DERIVED from the org data (no hand-maintained list): a Client
// Partner owns the accounts where they're the client_partner; a Delivery Manager
// owns the accounts of projects they run - matched via people.email = the login.
// Members of the leadership Entra group (IT-managed, like the transcription group)
// get full visibility without any app-side row. Optional: unset = feature off.
const LEADERSHIP_GROUP = (process.env.ENTRA_LEADERSHIP_GROUP_ID || '').toLowerCase();
const inLeadershipGroup = (user?: { groups?: string[] }) =>
  !!LEADERSHIP_GROUP && !!user?.groups?.some((g) => g.toLowerCase() === LEADERSHIP_GROUP);

async function allowedAccounts(req: Request): Promise<string[] | null> {
  const user = (req as Request & { user?: { email?: string; groups?: string[] } }).user;
  if (!user?.email) return null; // token/dev mode → full access
  if (inLeadershipGroup(user)) return null; // leadership group → full access
  const email = user.email.toLowerCase();
  const u = await q('SELECT role, scope FROM app_users WHERE lower(email) = lower($1)', [email]);
  const row = u.rows[0];
  if (row && (row.scope === 'all' || row.role === 'admin')) return null; // full access
  const r = await q(
    `SELECT a.id FROM accounts a JOIN people pe ON pe.id = a.client_partner WHERE lower(pe.email) = lower($1)
     UNION
     SELECT pr.account_id FROM projects pr JOIN people pe ON pe.id = pr.delivery_manager WHERE lower(pe.email) = lower($1) AND pr.account_id IS NOT NULL
     UNION
     SELECT pr.account_id FROM projects pr WHERE pr.account_id IS NOT NULL AND pr.delivery_manager_name IS NOT NULL
       AND lower(pr.delivery_manager_name) = (SELECT lower(p2.name) FROM people p2 WHERE lower(p2.email) = lower($1) LIMIT 1)`,
    [email]
  );
  return r.rows.map((x) => String(x.id));
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
    // 2. Derive their landing dashboard from the org data: Client Partner on any
    //    account -> partner view; otherwise delivery.
    const cp = await q(
      `SELECT 1 FROM accounts a JOIN people p ON p.id = a.client_partner
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
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.account_id = a.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' = 'Critical') THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.account_id = a.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END AS health,
              (SELECT count(*) FROM signals s WHERE s.account_id = a.id AND s.status = 'new') AS open_signals,
              COALESCE((SELECT round(100.0 * (sum(p.sow_value) - sum(p.budget_remaining)) / NULLIF(sum(p.sow_value), 0))
                        FROM projects p WHERE p.account_id = a.id AND p.budget_remaining IS NOT NULL), 0) AS budget_burn_pct,
              COALESCE((SELECT sum(p.budget_remaining) FROM projects p WHERE p.account_id = a.id), 0) AS headroom
       FROM accounts a
       LEFT JOIN people cp ON cp.id = a.client_partner
       LEFT JOIN people cd ON cd.id = a.client_director ${filter} ORDER BY a.name`,
      params
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Account drill-down - the account, its projects/SOWs, and recent signals.
router.get('/accounts/:id', async (req, res, next) => {
  try {
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
       FROM projects p WHERE p.account_id = $1 ORDER BY p.sow_value DESC NULLS LAST`,
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

// Calls (the source Teams calls) - includes the transcript for the transcript view.
router.get('/calls', async (req, res, next) => {
  try {
    const allowed = await allowedAccounts(req);
    const params: unknown[] = [];
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE account_id = ANY($${params.length}::uuid[])`; }
    const r = await q(
      `SELECT id, account_id, project_id, title, call_date, transcript, source
       FROM calls ${filter} ORDER BY call_date DESC NULLS LAST LIMIT 500`,
      params
    );
    res.json(r.rows);
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
       FROM projects p ${filter} ORDER BY p.sow_value DESC NULLS LAST`,
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
    let filter = '';
    if (allowed !== null) { params.push(allowed); filter = `WHERE s.account_id = ANY($${params.length}::uuid[])`; }
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
    for (const [key, col] of [['type', 'type'], ['status', 'status'], ['account_id', 'account_id']] as const) {
      if (req.query[key]) { params.push(req.query[key]); where.push(`s.${col} = $${params.length}`); }
    }
    if (allowed !== null) { params.push(allowed); where.push(`s.account_id = ANY($${params.length}::uuid[])`); }
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Number(req.query.offset || 0);
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
       FROM stakeholders ${filter} ORDER BY (buying_role IS NULL), name LIMIT 1000`,
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
       FROM deals ${filter} ORDER BY is_open DESC, amount DESC NULLS LAST LIMIT 500`,
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
    if (approve) {
      if (!(Number(amount) > 0)) return res.status(400).json({ error: 'a deal value (amount) is required' });
      if (!close_date || isNaN(Date.parse(String(close_date)))) return res.status(400).json({ error: 'a close date is required' });
    }
    const r = await q(
      `INSERT INTO hubspot_pushes (signal_id, account_id, deal_name, amount, close_date, status, given_by)
       SELECT s.id, s.account_id,
              COALESCE(NULLIF($4, ''), COALESCE(a.name || ' - ', '') || left(COALESCE(s.summary, 'Opportunity'), 120)),
              $5, $6, $2, $3
       FROM signals s LEFT JOIN accounts a ON a.id = s.account_id
       WHERE s.id = $1 AND s.type = 'opportunity'
       ON CONFLICT (signal_id) DO NOTHING
       RETURNING id, status`,
      [signal_id, approve ? 'pending' : 'declined', given_by || null,
       deal_name || '', approve ? Number(amount) : null, approve ? close_date : null]
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

router.post('/signal-notes', async (req, res, next) => {
  try {
    const { signal_id, note, author } = req.body || {};
    if (!signal_id || !note || !String(note).trim()) return res.status(400).json({ error: 'signal_id and note required' });
    const user = (req as Request & { user?: { email?: string; name?: string } }).user;
    const r = await q(
      `INSERT INTO signal_notes (signal_id, account_id, note, author)
       SELECT s.id, s.account_id, $2, $3 FROM signals s WHERE s.id = $1
       RETURNING id, signal_id, note, author, created_at`,
      [signal_id, String(note).trim(), user?.name || user?.email || author || 'dashboard']
    );
    if (!r.rows.length) return res.status(404).json({ error: 'signal not found' });
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// The single write path - Observability corrections feed the learning loop.
router.post('/feedback', async (req, res, next) => {
  try {
    const { signal_id, verdict, correct_type, reason, given_by } = req.body || {};
    if (!signal_id || !verdict) return res.status(400).json({ error: 'signal_id and verdict required' });
    if (!['correct', 'incorrect', 'relabel'].includes(String(verdict))) return res.status(400).json({ error: 'invalid verdict' });
    const r = await q(
      `INSERT INTO feedback (signal_id, account_id, verdict, correct_type, reason, given_by)
       SELECT $1, s.account_id, $2, $3, $4, $5 FROM signals s WHERE s.id = $1 RETURNING id`,
      [signal_id, verdict, correct_type || null, reason || null, given_by || null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'signal not found' });
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
