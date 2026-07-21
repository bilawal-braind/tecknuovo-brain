-- Access map seed (from the client's pod board, 20 Jul): Client Partner + Client
-- Director per account, so CPs/CDs can see their data while the Monday "Live Projects
-- and Allocations" board is still being filled in.
--
-- Plays nicely with the 07:10 org sync (workflow 4): the sync only writes
-- client_partner / client_director when Monday actually HAS a value, so this seed is
-- never nulled out - and once the Monday board is completed, Monday wins again
-- (org data drives access, as designed). people are created by name if missing,
-- the same upsert pattern workflow 4 uses.
--
-- ACCESS DEPENDS ON EMAIL: the API matches the login to people.email. Either set the
-- emails in the block at the bottom (works immediately), or leave them NULL and
-- self-wiring binds the email on each person's FIRST sign-in - but only when their
-- Entra display name exactly matches people.name and that name is unique. If a
-- display name differs (e.g. middle names), set the email here.
--
-- NOTE: requires the client_director column (db/2026-07_account_roles.sql) and the
-- updated Read API (client_director now grants account visibility, same as
-- client_partner). Deploy the API change alongside this seed.

BEGIN;

CREATE TEMP TABLE _access_map (patterns text[], cp text, cd text);
INSERT INTO _access_map (patterns, cp, cd) VALUES
  -- Central Gov 1 (Annette Banks)
  (ARRAY['dwp%'],                          'Alice Wells',          'Annette Banks'),
  (ARRAY['moj%','ministry of justice%'],   'Annette Banks',         'Annette Banks'),
  (ARRAY['mod','mod %','mod(%','ministry of defence%'], 'Annette Banks', 'Annette Banks'),
  (ARRAY['maps%'],                         'Will Walker',          NULL),  -- client confirmed 21 Jul: NOT Annette's
  (ARRAY['kainos%'],                       'Adam Adebowale-Lowe',  NULL),  -- client confirmed 21 Jul: NOT Annette's
  -- Central Gov 2 (Kiera Battersby)
  (ARRAY['cabo%','cabinet%'],              'Adam Adebowale-Lowe',  'Kiera Battersby'),
  (ARRAY['defra%'],                        'Kiera Battersby',      'Kiera Battersby'),
  (ARRAY['dvsa%'],                         'Adam Adebowale-Lowe',  'Kiera Battersby'),
  -- HMRC (+ other) (Meesha Chotai)
  (ARRAY['hmrc%'],                         NULL,                   'Meesha Chotai'),  -- no CP on the board (known gap) - director only
  (ARRAY['hawk%'],                         'Alice Wells',          'Meesha Chotai'),
  (ARRAY['gvms%'],                         'Alice Wells',          'Meesha Chotai'),
  (ARRAY['kms%'],                          'Alice Wells',          'Meesha Chotai'),
  (ARRAY['netcompany%'],                   'Will Walker',          'Meesha Chotai'),
  -- Utilities, Healthcare & Education (Jessica Kilkenny-Roddy)
  (ARRAY['thames%'],                       'Chloe Hollinshead',    'Jessica Kilkenny-Roddy'),
  (ARRAY['neso%'],                         'Luke Adams',           'Jessica Kilkenny-Roddy'),
  (ARRAY['nhs%'],                          'Adam Adebowale-Lowe',  'Jessica Kilkenny-Roddy'),
  (ARRAY['dfe%'],                          'Will Walker',          'Jessica Kilkenny-Roddy'),
  (ARRAY['voda%','vodafone%'],             'Alice Wells',          'Jessica Kilkenny-Roddy');

-- 1. Ensure every named person exists (by name, case-insensitive - workflow 4's
--    pattern, so the sync and this seed can never create duplicates of each other).
--    Director role wins when someone appears as both.
INSERT INTO people (name, role, is_internal)
SELECT DISTINCT ON (lower(nm)) nm, rl, true
FROM (
  SELECT cd AS nm, 'Client Director' AS rl, 0 AS pri FROM _access_map WHERE cd IS NOT NULL
  UNION ALL
  SELECT cp, 'Client Partner', 1 FROM _access_map WHERE cp IS NOT NULL
) x
WHERE NOT EXISTS (SELECT 1 FROM people p WHERE lower(p.name) = lower(x.nm))
ORDER BY lower(nm), pri;

-- 2. Link accounts to their Client Partner / Client Director.
UPDATE accounts a
SET client_partner = pe.id
FROM _access_map m
JOIN people pe ON lower(pe.name) = lower(m.cp)
WHERE m.cp IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(m.patterns) pat WHERE a.name ILIKE pat);

UPDATE accounts a
SET client_director = pe.id
FROM _access_map m
JOIN people pe ON lower(pe.name) = lower(m.cd)
WHERE m.cd IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(m.patterns) pat WHERE a.name ILIKE pat);

COMMIT;

-- ── Verify (run all three; paste the output back if anything looks off) ──────────

-- a) What every account now maps to:
SELECT a.name AS account,
       cp.name AS client_partner, cp.email AS cp_email,
       cd.name AS client_director, cd.email AS cd_email
FROM accounts a
LEFT JOIN people cp ON cp.id = a.client_partner
LEFT JOIN people cd ON cd.id = a.client_director
ORDER BY a.name;

-- b) Mapping rows that matched NO account (that client has no account row yet -
--    it will be created lazily on its first call, then re-run this seed):
SELECT m.patterns, m.cp, m.cd
FROM _access_map m
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a JOIN unnest(m.patterns) pat ON a.name ILIKE pat
);

-- c) Accounts still missing a CP or CD after the seed:
SELECT name FROM accounts WHERE client_partner IS NULL OR client_director IS NULL ORDER BY name;

-- ── Emails (recommended: fill these in and run now - access works immediately and
--    doesn't depend on display-name matching at first login) ──────────────────────
-- UPDATE people SET email = 'alice.wells@tecknuovo.com'      WHERE lower(name) = 'alice wells'          AND email IS NULL;
-- UPDATE people SET email = 'adam.alowe@tecknuovo.com' WHERE lower(name) = 'adam adebowale-lowe' AND email IS NULL;
-- UPDATE people SET email = 'will.walker@tecknuovo.com'      WHERE lower(name) = 'will walker'          AND email IS NULL;
-- UPDATE people SET email = 'chloe.hollinshead@tecknuovo.com' WHERE lower(name) = 'chloe hollinshead'   AND email IS NULL;
-- UPDATE people SET email = 'luke.adams@tecknuovo.com'       WHERE lower(name) = 'luke adams'           AND email IS NULL;
-- UPDATE people SET email = 'annette.banks@tecknuovo.com'     WHERE lower(name) = 'annette banks'         AND email IS NULL;
-- UPDATE people SET email = 'kiera.battersby@tecknuovo.com'  WHERE lower(name) = 'kiera battersby'      AND email IS NULL;
-- UPDATE people SET email = 'jessica.kilkenny-roddy@tecknuovo.com' WHERE lower(name) = 'jessica kilkenny-roddy' AND email IS NULL;
-- UPDATE people SET email = 'meesha.chotai@tecknuovo.com'    WHERE lower(name) = 'meesha chotai'        AND email IS NULL;
