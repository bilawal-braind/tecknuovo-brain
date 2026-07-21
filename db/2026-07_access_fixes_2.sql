-- Access fixes round 2 (21 Jul, from the client's post-demo feedback + the four
-- verification queries). Fixes, in order: the duplicate Jess/Jessica person split,
-- Annette's wrong surname (Banks, not Cole - the demo-data name), the DC-as-CP
-- contamination on HO (Julian Bock is a DM, pulled from Monday's "DC/ DM" column),
-- the accounts that exist on the client's pod board but have no row yet (so Luke /
-- Will / Alice get their portfolios instead of a blank dashboard), and the misfiled
-- Thames Water copy of "MOD DMS Assurance".
--
-- RUN ORDER (matters):
--   1. Re-import the UPDATED workflow 4 first (its stakeholder pass no longer reads
--      the "DC/ DM" column as a CP source) - otherwise the 07:10 sync puts the DC
--      contamination straight back.
--   2. Run this file.
--   3. Re-run db/2026-07_access_map_seed.sql (names corrected to Banks / Jessica;
--      idempotent) - it links CP/CD on the newly created accounts.
--   4. Run the email block at the bottom of the seed file.
--   5. Verify with the seed file's three verification queries.

BEGIN;

-- 1. Merge the two Jess rows. Her login binds "Jessica Kilkenny-Roddy" (the 15 Jul
--    row that already carries her real email); NHS + Thames Water pointed at the
--    empty 20 Jul "Jess Kilkenny-Roddy" duplicate, which is why she saw no data.
UPDATE accounts SET client_director = '598ba341-15a4-4a51-a661-5d6ed9c2b9c4'
WHERE client_director = '7dfb4c30-eff0-43d6-95bf-fe501d98e4c7';
UPDATE accounts SET client_partner = '598ba341-15a4-4a51-a661-5d6ed9c2b9c4'
WHERE client_partner = '7dfb4c30-eff0-43d6-95bf-fe501d98e4c7';
DELETE FROM people WHERE id = '7dfb4c30-eff0-43d6-95bf-fe501d98e4c7';

-- 2. Annette: the real person is Annette BANKS, Client Partner (the Cole surname
--    came from illustrative demo data). Keeps her existing MOJ / MOD / Ministry of
--    Justice links - only the row is corrected so her login can bind to it.
UPDATE people SET name = 'Annette Banks', role = 'Client Partner'
WHERE id = 'e8e43b52-e794-46c0-83ba-3124e7cd083e';

-- 3. HO: clear the DC-as-CP contamination (Julian Bock is a delivery manager; he
--    keeps his delivery access through the projects he runs). Leave CP empty until
--    the client names HO's real owner.
UPDATE accounts SET client_partner = NULL WHERE name = 'HO';

-- 4. Create the accounts from the client's pod board that have no row yet, using the
--    canonical client_directory spelling where one exists (so the Watcher's account
--    matching stays consistent when their first call arrives). Deliberately NOT
--    creating GVMS / HAWK / KMS: those are HMRC programmes - separate account rows
--    would steal HMRC's future calls in the Watcher's title match.
WITH want(label, pattern) AS (VALUES
  ('NESO',          'neso%'),
  ('MaPS',          'maps%'),
  ('DfE',           'dfe%'),
  ('Netcompany',    'netcompany%'),
  ('Kainos',        'kainos%'),
  ('DVSA',          'dvsa%'),
  ('VodafoneThree', 'voda%')
)
INSERT INTO accounts (name, last_verified)
SELECT COALESCE(
         (SELECT cd.name FROM client_directory cd
          WHERE cd.name ILIKE w.pattern ORDER BY length(cd.name) LIMIT 1),
         w.label),
       now()
FROM want w
ON CONFLICT (name) DO NOTHING;

-- 5. Remove the misfiled Thames Water copy of "MOD DMS Assurance" (the correct copy
--    lives under MOD). Guarded: only if nothing references it.
DELETE FROM projects p
WHERE p.name = 'MOD DMS Assurance'
  AND p.account_id = (SELECT id FROM accounts WHERE name = 'Thames Water')
  AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.project_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id);

COMMIT;

-- Now re-run db/2026-07_access_map_seed.sql (step 3 above), then its email block.
