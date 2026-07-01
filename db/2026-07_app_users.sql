-- Login + role-based access. One row per person: which dashboard they land on (role)
-- and how much they see (scope). The Read API enforces this server-side from the
-- Microsoft (Entra) token — a user only ever receives the data their scope allows.
--
--   role  : delivery | partner | leadership | observability
--   scope : own  -> only their accounts/projects (matched via person_name)
--           all  -> everything (e.g. Head of Delivery, MD, Leadership)
--   person_name : the org name to match on when scope='own'
--                 (projects.delivery_manager_name for delivery, account owner for partner).
--                 NULL when scope='all'.
CREATE TABLE IF NOT EXISTS app_users (
    email       text PRIMARY KEY,
    role        text NOT NULL,
    scope       text NOT NULL DEFAULT 'own',
    person_name text,
    name        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Safe re-run: add columns if the table already existed from the earlier version.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'own';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS person_name text;

-- Seed (edit to real TN emails). Lowercased.
INSERT INTO app_users (email, role, scope, person_name, name) VALUES
  ('bilawal.deu@tecknuovo.com',     'admin',         'all', NULL, 'Bilawal'),          -- admin: every dashboard + all data
  ('kiera.battersby@tecknuovo.com', 'delivery',      'all', NULL, 'Kiera Battersby'),  -- Head of Delivery: all deliveries
  ('meesha.chotai@tecknuovo.com',   'observability', 'all', NULL, 'Meesha Chotai')     -- Portfolio Director: all + QA/observability
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role, scope = EXCLUDED.scope, person_name = EXCLUDED.person_name, name = EXCLUDED.name;
