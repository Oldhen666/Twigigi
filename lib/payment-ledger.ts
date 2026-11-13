import { DatabaseSync } from "node:sqlite";
import { listingCycleKey } from "@/lib/fee-collection";
import { graceDeadline, paidUntilAfterPayment } from "@/lib/listing-cycle";

type SqlRow = Record<string, unknown>;

export function ensurePaymentLedger(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS provider_payments (
      provider TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      collection_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, transaction_id)
    );
    CREATE TABLE IF NOT EXISTS payment_events (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      PRIMARY KEY (provider, event_id)
    );
    CREATE TABLE IF NOT EXISTS fee_collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      provider_order_id TEXT NOT NULL DEFAULT '',
      provider_payment_id TEXT NOT NULL DEFAULT '',
      checkout_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS billing_notices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

function text(value: unknown) {
  return String(value ?? "");
}

function cents(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf(database: DatabaseSync, sql: string, ...params: Array<string | number>) {
  return database.prepare(sql).all(...params) as SqlRow[];
}

function oneOf(database: DatabaseSync, sql: string, ...params: Array<string | number>) {
  return (database.prepare(sql).get(...params) as SqlRow | undefined) ?? null;
}

export function stageFeeCollection(
  database: DatabaseSync,
  input: { id: string; userId: string; currency: string; now: string },
) {
  ensurePaymentLedger(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    const inFlight = oneOf(
      database,
      `SELECT id, amount_cents, currency, checkout_url, idempotency_key FROM fee_collections
       WHERE user_id = ? AND currency = ? AND status IN ('processing', 'unknown', 'action_required')
       ORDER BY created_at DESC LIMIT 1`,
      input.userId,
      input.currency,
    );
    if (inFlight) {
      database.exec("COMMIT");
      return {
        collectionId: text(inFlight.id),
        amountCents: cents(inFlight.amount_cents),
        currency: text(inFlight.currency) || input.currency,
        checkoutUrl: text(inFlight.checkout_url),
        idempotencyKey: text(inFlight.idempotency_key),
        created: false,
      };
    }
    const listings = rowsOf(
      database,
      `SELECT id, billing_period_key, amount_cents, collection_id, status
       FROM twig_bills
       WHERE user_id = ? AND currency = ? AND kind = 'listing' AND status IN ('pending', 'accrued', 'due', 'recorded') AND collection_id = ''`,
      input.userId,
      input.currency,
    );
    if (listings.length < 1) {
      database.exec("COMMIT");
      return null;
    }
    const periodKeys = listings.map((row) => text(row.billing_period_key)).filter(Boolean);
    const existingKey = listingCycleKey(input.userId, input.currency, periodKeys, "open");
    const existing = oneOf(
      database,
      `SELECT id, amount_cents, status, checkout_url FROM fee_collections
       WHERE user_id = ? AND idempotency_key = ? AND status IN ('processing', 'unknown', 'action_required')`,
      input.userId,
      existingKey,
    );
    if (existing) {
      database.exec("COMMIT");
      return {
        collectionId: text(existing.id),
        amountCents: cents(existing.amount_cents),
        currency: input.currency,
        checkoutUrl: text(existing.checkout_url),
        idempotencyKey: existingKey,
        created: false,
      };
    }
    const quotes = rowsOf(
      database,
      `SELECT id, amount_cents FROM twig_bills
       WHERE user_id = ? AND currency = ? AND kind = 'quote' AND status IN ('pending', 'accrued', 'due', 'recorded') AND collection_id = ''`,
      input.userId,
      input.currency,
    );
    const ids = [...listings.map((row) => text(row.id)), ...quotes.map((row) => text(row.id))];
    const amount = [...listings, ...quotes].reduce((sum, row) => sum + cents(row.amount_cents), 0);
    database.prepare(
      `INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, 'processing', ?, ?)`,
    ).run(input.id, input.userId, input.currency, amount, existingKey, input.now);
    const claim = database.prepare(
      `UPDATE twig_bills SET collection_id = ?, status = 'processing'
       WHERE id = ? AND user_id = ? AND collection_id = '' AND status IN ('pending', 'accrued', 'due', 'recorded')`,
    );
    for (const id of ids) claim.run(input.id, id, input.userId);
    database.exec("COMMIT");
    return { collectionId: input.id, amountCents: amount, currency: input.currency, checkoutUrl: "", idempotencyKey: existingKey, created: true };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function claimCollectionCheckout(database: DatabaseSync, collectionId: string, userId: string) {
  ensurePaymentLedger(database);
  const result = database.prepare(
    `UPDATE fee_collections SET provider_order_id = 'creating'
     WHERE id = ? AND user_id = ? AND status = 'processing' AND checkout_url = '' AND provider_order_id = ''`,
  ).run(collectionId, userId);
  return result.changes > 0;
}

export function releaseCollectionClaim(database: DatabaseSync, collectionId: string, userId: string) {
  ensurePaymentLedger(database);
  database.prepare(
    `UPDATE fee_collections SET provider_order_id = ''
     WHERE id = ? AND user_id = ? AND provider_order_id = 'creating' AND checkout_url = ''`,
  ).run(collectionId, userId);
}

export function saveCollectionCheckout(
  database: DatabaseSync,
  input: { collectionId: string; userId: string; provider: string; orderId: string; url: string },
) {
  ensurePaymentLedger(database);
  database.prepare(
    `UPDATE fee_collections
     SET provider = ?, provider_order_id = ?, checkout_url = ?, status = 'processing'
     WHERE id = ? AND user_id = ? AND status != 'paid'`,
  ).run(input.provider, input.orderId, input.url, input.collectionId, input.userId);
}

export function claimCollectionCharge(database: DatabaseSync, collectionId: string, userId: string) {
  ensurePaymentLedger(database);
  const result = database.prepare(
    `UPDATE fee_collections SET provider_order_id = 'charging'
     WHERE id = ? AND user_id = ? AND status IN ('processing', 'unknown') AND provider_payment_id = '' AND provider_order_id IN ('', 'charging')`,
  ).run(collectionId, userId);
  return result.changes > 0;
}

export function saveCollectionPaymentId(database: DatabaseSync, collectionId: string, userId: string, paymentId: string) {
  ensurePaymentLedger(database);
  if (!paymentId) return;
  database.prepare(
    `UPDATE fee_collections
     SET provider = 'stripe', provider_payment_id = ?, provider_order_id = ?
     WHERE id = ? AND user_id = ? AND status != 'paid'`,
  ).run(paymentId, paymentId, collectionId, userId);
}

export function noteCollectionHold(
  database: DatabaseSync,
  input: { collectionId: string; userId: string; paymentId: string; status: "unknown" | "action_required" },
) {
  ensurePaymentLedger(database);
  const collection = oneOf(database, `SELECT status, user_id FROM fee_collections WHERE id = ?`, input.collectionId);
  if (!collection || text(collection.user_id) !== input.userId || text(collection.status) === "paid") return false;
  database.prepare(
    `UPDATE fee_collections
     SET status = ?, provider = 'stripe', provider_payment_id = CASE WHEN ? != '' THEN ? ELSE provider_payment_id END
     WHERE id = ? AND user_id = ? AND status != 'paid'`,
  ).run(input.status, input.paymentId, input.paymentId, input.collectionId, input.userId);
  return true;
}

export function collectionOwner(database: DatabaseSync, collectionId: string) {
  ensurePaymentLedger(database);
  const row = oneOf(database, `SELECT user_id FROM fee_collections WHERE id = ?`, collectionId);
  return row ? text(row.user_id) : "";
}

export function readCollection(database: DatabaseSync, collectionId: string, userId: string) {
  ensurePaymentLedger(database);
  const row = oneOf(
    database,
    `SELECT id, status, amount_cents, currency, checkout_url, provider_payment_id FROM fee_collections WHERE id = ? AND user_id = ?`,
    collectionId,
    userId,
  );
  if (!row) return null;
  return {
    id: text(row.id),
    status: text(row.status),
    amountCents: cents(row.amount_cents),
    currency: text(row.currency),
    checkoutUrl: text(row.checkout_url),
    providerPaymentId: text(row.provider_payment_id),
  };
}

export type PaymentNotice = { kind: string; dedupeKey: string; subject: string; body: string };

function paymentResult(applied: boolean, alreadyApplied: boolean, outcome: "paid" | "failed" | "duplicate" | "rejected", notices: PaymentNotice[] = []) {
  return { applied, alreadyApplied, outcome, notices };
}

export function applyPaymentResult(
  database: DatabaseSync,
  input: {
    provider: "stripe" | "paypal";
    transactionId: string;
    eventId?: string;
    userId: string;
    collectionId: string;
    paidAt: string;
    succeeded: boolean;
  },
) {
  ensurePaymentLedger(database);
  if (!input.transactionId || !input.collectionId) return paymentResult(false, false, "rejected");
  database.exec("BEGIN IMMEDIATE");
  try {
    if (input.eventId) {
      const seen = oneOf(database, `SELECT event_id FROM payment_events WHERE provider = ? AND event_id = ?`, input.provider, input.eventId);
      if (seen) {
        database.exec("COMMIT");
        return paymentResult(false, true, "duplicate");
      }
      database.prepare(`INSERT INTO payment_events (provider, event_id) VALUES (?, ?)`).run(input.provider, input.eventId);
    }
    const prior = oneOf(
      database,
      `SELECT status FROM provider_payments WHERE provider = ? AND transaction_id = ?`,
      input.provider,
      input.transactionId,
    );
    if (text(prior?.status) === "paid") {
      database.exec("COMMIT");
      return paymentResult(false, true, "duplicate");
    }
    const collection = oneOf(database, `SELECT status, user_id FROM fee_collections WHERE id = ?`, input.collectionId);
    if (!collection || text(collection.user_id) !== input.userId) {
      database.exec("ROLLBACK");
      return paymentResult(false, false, "rejected");
    }
    if (text(collection.status) === "paid") {
      database.exec("COMMIT");
      return paymentResult(false, true, "duplicate");
    }
    if (!input.succeeded) {
      database.prepare(
        `INSERT INTO provider_payments (provider, transaction_id, user_id, collection_id, status, created_at)
         VALUES (?, ?, ?, ?, 'failed', ?)
         ON CONFLICT(provider, transaction_id) DO UPDATE SET status = 'failed'`,
      ).run(input.provider, input.transactionId, input.userId, input.collectionId, input.paidAt);
      const listingRows = rowsOf(
        database,
        `SELECT DISTINCT product_id FROM twig_bills WHERE collection_id = ? AND user_id = ? AND kind = 'listing'`,
        input.collectionId,
        input.userId,
      );
      database.prepare(
        `UPDATE twig_bills SET status = 'pending', collection_id = ''
         WHERE collection_id = ? AND user_id = ? AND status != 'paid'`,
      ).run(input.collectionId, input.userId);
      database.prepare(
        `UPDATE fee_collections SET status = 'failed', provider_payment_id = ?, checkout_url = '' WHERE id = ? AND user_id = ?`,
      ).run(input.transactionId, input.collectionId, input.userId);
      const grace = graceDeadline(input.paidAt);
      let enteredGrace = false;
      for (const row of listingRows) {
        const updated = database.prepare(
          `UPDATE products SET billing_status = 'grace', grace_until = ?, updated_at = ?
           WHERE id = ? AND user_id = ? AND billing_status = 'active'`,
        ).run(grace, input.paidAt, text(row.product_id), input.userId);
        if (updated.changes > 0) enteredGrace = true;
      }
      database.exec("COMMIT");
      const notices = [
        {
          kind: "failed",
          dedupeKey: `failed:${input.collectionId}`,
          subject: "Twigigi payment failed",
          body: "Twigigi could not take the listing payment. Nothing in that payment was marked paid. Other listings were not changed.",
        },
      ];
      if (enteredGrace) {
        notices.push({
          kind: "grace",
          dedupeKey: `grace:${input.collectionId}`,
          subject: "A Twigigi listing is in its grace period",
          body: "The listing stays visible for 72 hours. Pay during that time to keep the same 30-day cycle. After 72 hours, only that listing pauses.",
        });
      }
      return paymentResult(true, false, "failed", notices);
    }
    database.prepare(
      `INSERT INTO provider_payments (provider, transaction_id, user_id, collection_id, status, created_at)
       VALUES (?, ?, ?, ?, 'paid', ?)
       ON CONFLICT(provider, transaction_id) DO UPDATE SET status = 'paid', collection_id = excluded.collection_id`,
    ).run(input.provider, input.transactionId, input.userId, input.collectionId, input.paidAt);
    const listingBills = rowsOf(
      database,
      `SELECT DISTINCT product_id FROM twig_bills WHERE collection_id = ? AND user_id = ? AND kind = 'listing' AND status != 'paid'`,
      input.collectionId,
      input.userId,
    );
    const notices: PaymentNotice[] = [{
      kind: "paid",
      dedupeKey: `paid:${input.collectionId}`,
      subject: "Twigigi payment received",
      body: "Twigigi received this listing payment. Quote fees in the same currency that were included are marked paid separately. Buyer payments to you are not part of this charge.",
    }];
    for (const row of listingBills) {
      const productId = text(row.product_id);
      const product = oneOf(
        database,
        `SELECT paid_until, billing_status, grace_until, auto_renew, status FROM products WHERE id = ? AND user_id = ?`,
        productId,
        input.userId,
      );
      if (!product) continue;
      const previous = text(product.billing_status);
      if (previous === "grace" || previous === "paused") {
        notices.push({
          kind: "restored",
          dedupeKey: `restored:${productId}:${input.transactionId}`,
          subject: "Twigigi listing is active again",
          body: previous === "paused"
            ? "Payment after the grace period started a new 30-day cycle for that listing."
            : "Payment during the grace period extended that listing from its previous end date.",
        });
      }
      const next = paidUntilAfterPayment({
        paidUntil: text(product.paid_until),
        billingStatus: text(product.billing_status),
        graceUntil: text(product.grace_until),
        autoRenew: Number(product.auto_renew) === 1,
        paidAt: input.paidAt,
      });
      database.prepare(
        `UPDATE products
         SET paid_until = ?, next_renewal_at = ?, grace_until = '', billing_status = 'active', billing_version = 1,
             billing_started_at = COALESCE(NULLIF(billing_started_at, ''), ?),
             status = CASE WHEN status IN ('draft', 'deactivated') THEN 'published' ELSE status END,
             deactivates_at = NULL, deactivated_at = NULL, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(next.paidUntil, next.paidUntil, input.paidAt, input.paidAt, productId, input.userId);
      database.prepare(
        `UPDATE twig_bills SET period_start = ?, period_end = ? WHERE collection_id = ? AND user_id = ? AND product_id = ? AND kind = 'listing'`,
      ).run(next.periodKey, next.paidUntil, input.collectionId, input.userId, productId);
    }
    database.prepare(
      `UPDATE twig_bills SET status = 'paid', paid_at = ?, charge_key = ?
       WHERE collection_id = ? AND user_id = ? AND status != 'paid'`,
    ).run(input.paidAt, input.transactionId, input.collectionId, input.userId);
    database.prepare(
      `UPDATE fee_collections SET status = 'paid', provider = ?, provider_payment_id = ? WHERE id = ? AND user_id = ?`,
    ).run(input.provider, input.transactionId, input.collectionId, input.userId);
    database.exec("COMMIT");
    return paymentResult(true, false, "paid", notices);
  } catch (error) {
    database.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE")) return paymentResult(false, true, "duplicate");
    throw error;
  }
}
