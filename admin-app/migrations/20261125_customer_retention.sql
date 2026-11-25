-- Petrocrib customer retention and order archive additions.
-- Apply to the production database after reviewing/testing this migration.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archiveNote" text NULL;
CREATE INDEX IF NOT EXISTS "Order_archivedAt_createdAt_idx" ON "Order" ("archivedAt", "createdAt" DESC);

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" boolean NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" timestamptz NULL;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentSource" text NULL;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingUnsubscribeToken" text NULL;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingUnsubscribedAt" timestamptz NULL;
UPDATE "Customer" SET "marketingUnsubscribeToken" = gen_random_uuid()::text WHERE "marketingUnsubscribeToken" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_marketingUnsubscribeToken_key" ON "Customer" ("marketingUnsubscribeToken");
CREATE INDEX IF NOT EXISTS "Customer_marketingConsent_idx" ON "Customer" ("marketingConsent", "marketingUnsubscribedAt");

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
  "id" text PRIMARY KEY,
  "subject" text NOT NULL,
  "bodyHtml" text NOT NULL,
  "sentCount" integer NOT NULL DEFAULT 0,
  "failedCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
