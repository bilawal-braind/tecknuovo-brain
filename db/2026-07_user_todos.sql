-- Personal to-do list ("Add to list" on suggested actions - Kiera, 25 Jul call).
-- Per-user by login email; token/dev mode shares the '' user. Run once.
CREATE TABLE IF NOT EXISTS user_todos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email  text NOT NULL DEFAULT '',
    signal_id   uuid REFERENCES signals(id) ON DELETE CASCADE,
    title       text NOT NULL,
    account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
    done        boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    done_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_todos_user ON user_todos(lower(user_email));

-- When the API moves to the hardened tn_api_read role (db/api_role.sql):
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_todos TO tn_api_read;
