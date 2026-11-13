import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { cardCanRenew, outcomeForIntent, renewalStep, setupAuthorization, BILLING_CONSENT_VERSION } from "../lib/billing-auth.ts";
import { applyPaymentResult, ensurePaymentLedger, noteCollectionHold, stageFeeCollection } from "../lib/payment-ledger.ts";

function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, user_id TEXT, status TEXT, paid_until TEXT DEFAULT '', next_renewal_at TEXT DEFAULT '',
      grace_until TEXT DEFAULT '', billing_status TEXT DEFAULT '', billing_currency TEXT DEFAULT '',
      billing_version INTEGER DEFAULT 0, billing_started_at TEXT DEFAULT '', auto_renew INTEGER DEFAULT 1,
      deactivates_at TEXT, deactivated_at TEXT, updated_at TEXT
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, kind TEXT, amount_cents INTEGER, currency TEXT,
      status TEXT, collection_id TEXT DEFAULT '', billing_period_key TEXT DEFAULT '', paid_at TEXT DEFAULT '',
      charge_key TEXT DEFAULT '', period_start TEXT DEFAULT '', period_end TEXT DEFAULT ''
    );
  `);
  return db;
}

test("a one-time payment is not an off-session authorization", () => {
  assert.equal(setupAuthorization({
    purpose: "twigigi_fees",
    userId: "usr",
    expectedUserId: "usr",
    sessionComplete: true,
    intentStatus: "succeeded",
    usage: "off_session",
    paymentMethodId: "pm_card",
    customerId: "cus_123",
    consentVersion: BILLING_CONSENT_VERSION,
  }), "incomplete");
  assert.equal(setupAuthorization({
    purpose: "billing_setup",
    userId: "usr",
    expectedUserId: "usr",
    sessionComplete: true,
    intentStatus: "succeeded",
    usage: "on_session",
    paymentMethodId: "pm_card",
    customerId: "cus_123",
    consentVersion: BILLING_CONSENT_VERSION,
  }), "incomplete");
  assert.equal(setupAuthorization({
    purpose: "billing_setup",
    userId: "usr",
    expectedUserId: "usr",
    sessionComplete: true,
    intentStatus: "succeeded",
    usage: "off_session",
    paymentMethodId: "pm_card",
    customerId: "cus_123",
    consentVersion: BILLING_CONSENT_VERSION,
  }), "authorized");
});

test("automatic renewal stays off without a saved card and the charge switch", () => {
  assert.equal(cardCanRenew({ method: "paypal", ready: true, authStatus: "authorized", paymentMethodId: "pm_card", consentVersion: BILLING_CONSENT_VERSION }), false);
  assert.equal(cardCanRenew({ method: "card", ready: true, authStatus: "pending", paymentMethodId: "pm_card", consentVersion: BILLING_CONSENT_VERSION }), false);
  assert.equal(renewalStep({ chargeEnabled: false, authorized: true, collectionStatus: "processing", paymentId: "", intent: null }), "idle");
  assert.equal(renewalStep({ chargeEnabled: true, authorized: false, collectionStatus: "processing", paymentId: "", intent: null }), "idle");
  assert.equal(renewalStep({ chargeEnabled: true, authorized: true, collectionStatus: "processing", paymentId: "", intent: null }), "create");
  assert.equal(renewalStep({ chargeEnabled: false, authorized: true, collectionStatus: "processing", paymentId: "pi_123", intent: "succeeded" }), "paid");
  assert.equal(outcomeForIntent("requires_action"), "action_required");
  assert.equal(outcomeForIntent("requires_payment_method"), "failed");
  assert.equal(outcomeForIntent("processing"), "unknown");
});

test("an unknown payment keeps the quote on the original collection", () => {
  const db = openDb();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key) VALUES ('bill_a', 'usr', 'prd_a', 'listing', 149, 'CAD', 'due', '2026-12-01T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status) VALUES ('q1', 'usr', 'prd_a', 'quote', 25, 'CAD', 'pending')`).run();
  const staged = stageFeeCollection(db, { id: "col_hold", userId: "usr", currency: "CAD", now: "2026-12-01T00:00:00.000Z" });
  assert.ok(staged);
  assert.equal(noteCollectionHold(db, { collectionId: staged.collectionId, userId: "usr", paymentId: "pi_hold", status: "unknown" }), true);
  const again = stageFeeCollection(db, { id: "col_other", userId: "usr", currency: "CAD", now: "2026-12-01T00:00:00.000Z" });
  const quote = db.prepare(`SELECT status, collection_id FROM twig_bills WHERE id = 'q1'`).get() as { status: string; collection_id: string };
  assert.equal(again?.collectionId, staged.collectionId);
  assert.equal(quote.status, "processing");
  assert.equal(quote.collection_id, staged.collectionId);
  const paid = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_hold",
    eventId: "evt_hold",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: "2026-12-01T00:00:00.000Z",
    succeeded: true,
  });
  const duplicate = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_hold",
    eventId: "evt_hold_2",
    userId: "usr",
    collectionId: staged.collectionId,
    paidAt: "2026-12-02T00:00:00.000Z",
    succeeded: true,
  });
  const bill = db.prepare(`SELECT status FROM twig_bills WHERE id = 'q1'`).get() as { status: string };
  assert.equal(paid.outcome, "paid");
  assert.equal(duplicate.alreadyApplied, true);
  assert.equal(bill.status, "paid");
  ensurePaymentLedger(db);
  db.close();
});
