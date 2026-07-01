-- Who the Watcher polls for Teams transcripts. One row per person whose meetings
-- we're allowed to ingest (our-side allow-list — we never pull transcripts for
-- people not on this list). graph_user_id = their Entra object id or UPN.
CREATE TABLE IF NOT EXISTS watchlist (
    graph_user_id text PRIMARY KEY,      -- Entra object id (GUID) or UPN of the meeting organizer
    display_name  text,
    active        boolean NOT NULL DEFAULT true,
    added_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed with the people to watch (paste real GUIDs/UPNs). Example rows commented out:
-- INSERT INTO watchlist (graph_user_id, display_name) VALUES
--   ('00000000-0000-0000-0000-000000000000', 'Sarah Facey'),
--   ('bilawal.deu@tecknuovo.com',            'Bilawal Deu')
-- ON CONFLICT (graph_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, active = true;
