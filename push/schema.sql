CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_installation_idx
  ON subscriptions(installation_id);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  scheduled_at INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (installation_id, id)
);
CREATE INDEX IF NOT EXISTS notifications_due_idx
  ON scheduled_notifications(sent, scheduled_at);
