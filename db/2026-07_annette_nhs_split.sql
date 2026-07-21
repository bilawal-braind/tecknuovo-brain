-- 21 Jul round: Annette's confirmed email, MaPS + Kainos removed from her portfolio
-- (client ask), and the NHS split - CNWL and K&R become their own accounts so one
-- trust's calls stop bleeding into the other's view.
--
-- Run AFTER re-importing the updated workflow 1 (its name-canonicalisation now keeps
-- the specific directory name the classifier picked - without that re-import, new
-- "NHS CNWL" attributions would collapse straight back to "NHS").

BEGIN;

-- 1. Annette: confirmed address - the last of the five demo names goes live.
UPDATE people SET email = 'annette.banks@tecknuovo.com' WHERE lower(name) = 'annette banks';

-- 2. Client: MaPS and Kainos out of Annette's portfolio (CPs Will/Adam keep theirs).
UPDATE accounts SET client_director = NULL
WHERE (name ILIKE 'maps%' OR name ILIKE 'kainos%')
  AND client_director = (SELECT id FROM people WHERE lower(name) = 'annette banks');

-- 3. NHS split. New accounts inherit NHS's owners (Adam CP / Jessica CD), and both
--    names join the client directory so the Watcher's longest-match-wins title rule
--    and the classifier's candidate list route future calls to the right trust.
INSERT INTO accounts (name, pod, client_partner, client_director, last_verified)
SELECT v.n, a.pod, a.client_partner, a.client_director, now()
FROM (VALUES ('NHS CNWL'), ('NHS K&R')) v(n)
JOIN accounts a ON a.name = 'NHS'
ON CONFLICT (name) DO NOTHING;

INSERT INTO client_directory (name, source)
VALUES ('NHS CNWL', 'manual'), ('NHS K&R', 'manual')
ON CONFLICT (name) DO UPDATE SET last_seen = now();

-- 3a. Projects whose names say which trust they belong to.
UPDATE projects SET account_id = (SELECT id FROM accounts WHERE name = 'NHS CNWL'), account_name = 'NHS CNWL'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'NHS') AND name ILIKE '%CNWL%';
UPDATE projects SET account_id = (SELECT id FROM accounts WHERE name = 'NHS K&R'), account_name = 'NHS K&R'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'NHS') AND name ~* 'K\s*[&+]\s*R';

-- 3b. Calls whose titles say which trust, and their signals follow.
UPDATE calls SET account_id = (SELECT id FROM accounts WHERE name = 'NHS CNWL')
WHERE account_id = (SELECT id FROM accounts WHERE name = 'NHS') AND title ILIKE '%CNWL%';
UPDATE calls SET account_id = (SELECT id FROM accounts WHERE name = 'NHS K&R')
WHERE account_id = (SELECT id FROM accounts WHERE name = 'NHS') AND title ~* 'K\s*[&+]\s*R';
UPDATE signals s SET account_id = c.account_id
FROM calls c
WHERE s.call_id = c.id
  AND s.account_id = (SELECT id FROM accounts WHERE name = 'NHS')
  AND c.account_id IN (SELECT id FROM accounts WHERE name IN ('NHS CNWL', 'NHS K&R'));

-- 3c. Signals tied to a moved project follow their project.
UPDATE signals s SET account_id = p.account_id
FROM projects p
WHERE s.project_id = p.id
  AND s.account_id = (SELECT id FROM accounts WHERE name = 'NHS')
  AND p.account_id IN (SELECT id FROM accounts WHERE name IN ('NHS CNWL', 'NHS K&R'));

COMMIT;

-- What stays on plain "NHS": anything whose title/project names neither trust - it
-- can't be split automatically without guessing. Use the signal cards' "Wrong
-- account? Move this signal" to re-file those by hand; future calls route correctly
-- on their own. Verify the split:
SELECT a.name,
       (SELECT count(*) FROM calls c   WHERE c.account_id = a.id) AS calls,
       (SELECT count(*) FROM signals s WHERE s.account_id = a.id) AS signals,
       (SELECT count(*) FROM projects p WHERE p.account_id = a.id) AS projects
FROM accounts a WHERE a.name IN ('NHS', 'NHS CNWL', 'NHS K&R');
