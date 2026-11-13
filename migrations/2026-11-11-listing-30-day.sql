-- Additive listing billing columns. Applied by lib/db.ts so a second startup is a no-op.
-- Does not delete paid bills. Listings with no paid listing bill become legacy_review
-- and are not back-charged. Unverified due listing rows for those listings are marked void.
--
-- Rollback, not executed: leave the new columns in place. Dropping them would discard
-- paid_until and must not be run against production.

ALTER TABLE products ADD COLUMN paid_until TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN next_renewal_at TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN grace_until TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN billing_status TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN billing_currency TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN billing_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE twig_bills ADD COLUMN billing_period_key TEXT NOT NULL DEFAULT '';
ALTER TABLE twig_bills ADD COLUMN event_key TEXT NOT NULL DEFAULT '';
ALTER TABLE twig_bills ADD COLUMN quote_id TEXT NOT NULL DEFAULT '';
ALTER TABLE twig_bills ADD COLUMN due_at TEXT NOT NULL DEFAULT '';
ALTER TABLE twig_bills ADD COLUMN paid_at TEXT NOT NULL DEFAULT '';
ALTER TABLE twig_bills ADD COLUMN collection_id TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS twig_bills_listing_period
  ON twig_bills(product_id, billing_period_key)
  WHERE kind = 'listing' AND billing_period_key != '';

CREATE UNIQUE INDEX IF NOT EXISTS twig_bills_quote_event
  ON twig_bills(event_key)
  WHERE kind = 'quote' AND event_key != '';
