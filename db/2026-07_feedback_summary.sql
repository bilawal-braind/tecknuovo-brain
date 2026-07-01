-- Per-account "lessons" distilled from human feedback (Correct/Incorrect/Relabel).
-- Written nightly by the Feedback Summary workflow (#3), read by the Main Pipeline
-- when classifying that account's next call. This is how the brain learns from
-- corrections without retraining the model — the lessons ride along in the prompt.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS feedback_summary text;
