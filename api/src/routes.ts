import { Router } from 'express';
import { q } from './db.js';

export const router = Router();

// Portfolio / list view — accounts with a count of open signals (Leadership, Client Partner, Portfolio).
router.get('/accounts', async (_req, res, next) => {
  try {
    const r = await q(
      `SELECT a.id, a.name, a.pod,
              -- health is DERIVED from open risk signals (Monday has no client RAG)
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.account_id = a.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' IN ('High','Critical')) THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.account_id = a.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END AS health,
              (SELECT count(*) FROM signals s WHERE s.account_id = a.id AND s.status = 'new') AS open_signals,
              -- commercial rollup, derived from project budget_remaining vs sow_value
              COALESCE((SELECT round(100.0 * (sum(p.sow_value) - sum(p.budget_remaining)) / NULLIF(sum(p.sow_value), 0))
                        FROM projects p WHERE p.account_id = a.id AND p.budget_remaining IS NOT NULL), 0) AS budget_burn_pct,
              COALESCE((SELECT sum(p.budget_remaining) FROM projects p WHERE p.account_id = a.id), 0) AS headroom
       FROM accounts a ORDER BY a.name`
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Account drill-down — the account, its projects/SOWs, and recent signals.
router.get('/accounts/:id', async (req, res, next) => {
  try {
    const acc = await q('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!acc.rows.length) return res.status(404).json({ error: 'not found' });
    const projects = await q(
      `SELECT p.id, p.name, p.sow_value, p.sow_status, p.commercial_model, p.start_date, p.end_date,
              p.budget_remaining, (p.sow_value - p.budget_remaining) AS spend, p.delivery_manager_name,
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' IN ('High','Critical')) THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END AS rag
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

// Calls (the source Teams calls). The dashboard groups signals under these.
router.get('/calls', async (_req, res, next) => {
  try {
    const r = await q(
      `SELECT id, account_id, project_id, title, call_date, source
       FROM calls ORDER BY call_date DESC NULLS LAST LIMIT 500`
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Flat projects list (the dashboard hydrates its org tree from this + /accounts).
router.get('/projects', async (_req, res, next) => {
  try {
    const r = await q(
      `SELECT p.id, p.name, p.account_id, p.sow_value, p.sow_status, p.commercial_model, p.start_date, p.end_date,
              p.budget_remaining, (p.sow_value - p.budget_remaining) AS spend, p.delivery_manager_name,
              CASE
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new' AND s.details->>'band' IN ('High','Critical')) THEN 'red'
                WHEN EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id AND s.type = 'risk' AND s.status = 'new') THEN 'amber'
                ELSE 'green'
              END AS rag
       FROM projects p ORDER BY p.sow_value DESC NULLS LAST`
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Associates (consultants on the ground). No PII (no email/phone).
router.get('/associates', async (_req, res, next) => {
  try {
    const r = await q(
      `SELECT id, name, account_id, project_or_programme, placement_status
       FROM associates ORDER BY name`
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Signals feed — filterable by type/status/account, paginated.
router.get('/signals', async (req, res, next) => {
  try {
    const where: string[] = [];
    const params: any[] = [];
    for (const [key, col] of [['type', 'type'], ['status', 'status'], ['account_id', 'account_id']] as const) {
      if (req.query[key]) { params.push(req.query[key]); where.push(`s.${col} = $${params.length}`); }
    }
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

// The single write path — Observability corrections feed the learning loop.
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
