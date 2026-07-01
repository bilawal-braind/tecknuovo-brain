-- Login: who can see the dashboard + which role-view they land on.
-- TN manages this table (email -> role). Unlisted TN emails fall back to a default
-- role set on the API (DEFAULT_ROLE), so a new joiner still gets in.
CREATE TABLE IF NOT EXISTS app_users (
    email      text PRIMARY KEY,
    role       text NOT NULL,          -- delivery | partner | leadership | observability | qa
    name       text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed a few examples (edit to real TN emails). Lowercased emails.
INSERT INTO app_users (email, role, name) VALUES
  ('katie.carruthers@tecknuovo.com', 'leadership', 'Katie Carruthers'),
  ('kiera.battersby@tecknuovo.com',  'delivery',   'Kiera Battersby'),
  ('alice.wells@tecknuovo.com',      'partner',    'Alice Wells')
ON CONFLICT (email) DO NOTHING;
