-- Slack agent phase (26 Aug): personal morning briefs + two-way replies.
-- Workflows 22 (Kiera, weekdays 08:00), 23 (Chloe, Fridays 07:00) and
-- 24 (reply handler) are imported INACTIVE - they require TN's Slack bot
-- token in the n8n environment as TN_SLACK_BOT_TOKEN, and wf24 additionally
-- needs the n8n webhook /webhook/tnai-slack-events reachable from Slack.
-- Activate with: n8n publish:workflow --id=tnAiBriefKiera22 (etc) + pm2 restart n8n.

-- Reply resolution: each sent brief records which signal each numbered item
-- refers to, so "done 2" from Slack maps to the exact signal.
CREATE TABLE IF NOT EXISTS brief_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,          -- Slack user id once known, email before first send
  item_no int NOT NULL,
  signal_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
-- email -> Slack user id, learned on first successful DM
CREATE TABLE IF NOT EXISTS slack_users (
  email text PRIMARY KEY,
  slack_user_id text NOT NULL
);
