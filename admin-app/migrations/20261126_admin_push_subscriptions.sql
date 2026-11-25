-- Admin-only browser push subscriptions. Apply to a non-production database first.
CREATE TABLE IF NOT EXISTS "AdminPushSubscription" (
  "id" text PRIMARY KEY,
  "endpoint" text NOT NULL UNIQUE,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "AdminPushSubscription_updatedAt_idx"
  ON "AdminPushSubscription" ("updatedAt");
