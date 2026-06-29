-- Least-privilege role for the Read API (run once as admin).
-- SELECT on everything + INSERT only on feedback (the single write path). No update/delete anywhere.
CREATE ROLE tn_api_read LOGIN PASSWORD 'CHANGE_ME_LONG_RANDOM';

GRANT CONNECT ON DATABASE postgres TO tn_api_read;
GRANT USAGE ON SCHEMA public TO tn_api_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tn_api_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tn_api_read;

-- The one allowed write:
GRANT INSERT ON feedback TO tn_api_read;
