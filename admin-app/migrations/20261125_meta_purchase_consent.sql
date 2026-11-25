CREATE TABLE IF NOT EXISTS "MetaPurchaseConsent" (
  "orderId" text PRIMARY KEY,
  "consentedAt" timestamptz NOT NULL,
  "lastAttemptAt" timestamptz,
  "sentAt" timestamptz
);
