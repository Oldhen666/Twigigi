import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { listingFeeCents } from "../lib/billing.ts";
import { previewCollections } from "../lib/fee-collection.ts";
import { QUOTE_FOLLOWUP_CENTS, QUOTE_LISTING_CENTS, previewQuoteListingCharge, publicBusinessName, quoteBillingAnchor, quoteFeeExample, quotePublishOffer, quoteRenewalLine } from "../lib/quote-followup.ts";
import {
  ensureQuoteFollowup,
  followupFeeCovered,
  listFollowupFeeLines,
  listOpenFollowupFees,
  lockQuoteListingRate,
  markFollowupSent,
  markInvoicePaid,
  readQuoteSettings,
  reconcileFollowupFees,
  recordFollowupFee,
  saveFollowupDraft,
  saveQuoteSettings,
  setFollowupStatus,
} from "../lib/quote-followup-store.ts";

const NOW = "2026-11-21T18:00:00.000Z";

function db() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, cta TEXT, status TEXT, title TEXT NOT NULL DEFAULT '', billing_currency TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE quotes (
      id TEXT PRIMARY KEY, product_id TEXT, name TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, kind TEXT, amount_cents INTEGER, currency TEXT,
      method TEXT DEFAULT '', status TEXT, collection_id TEXT DEFAULT '', billing_period_key TEXT DEFAULT '',
      event_key TEXT DEFAULT '', paid_at TEXT DEFAULT '', charge_key TEXT DEFAULT '',
      period_start TEXT DEFAULT '', period_end TEXT DEFAULT '', due_at TEXT DEFAULT '', quote_id TEXT DEFAULT '',
      created_at TEXT DEFAULT ''
    );
  `);
  return database;
}

test("a new quote confirmation uses C$4.99 and an existing locked price stays on its own renewal day", () => {
  assert.equal(quoteBillingAnchor("2026-11-10T18:00:00.000Z"), 15);
  assert.equal(quoteBillingAnchor("2026-11-21T18:00:00.000Z"), 28);
  assert.equal(quoteBillingAnchor("2026-11-21T18:00:00.000Z", 15), 15);
  const fresh = quotePublishOffer({ now: "2026-11-21T18:00:00.000Z", settings: null });
  assert.equal(fresh.cents, QUOTE_LISTING_CENTS);
  assert.equal(fresh.currency, "CAD");
  assert.equal(fresh.anchor, 28);
  assert.equal(quoteRenewalLine(fresh.cents, fresh.currency, fresh.anchor), "Renews at C$4.99 on the 28th of each month.");
  const legacy = previewQuoteListingCharge({ listingRateCents: 149, listingCurrency: "USD" });
  assert.deepEqual(legacy, { cents: 149, currency: "USD", legacy: true });
  assert.equal(quoteRenewalLine(legacy.cents, legacy.currency, 15), "Renews at USD$1.49 on the 15th of each month.");
  assert.match(quoteFeeExample(), /Example: 1 listing \(C\$4\.99\) \+ first follow-ups on 5 inquiries \(C\$2\.50\) = C\$7\.49 before tax\./);
  assert.match(quoteFeeExample(), /next bill includes that listing renewal and these follow-up fees/);
});

test("a skipped business profile keeps the seller display name", () => {
  const database = db();
  saveQuoteSettings(database, {
    productId: "prd",
    businessName: "North Yard",
    businessBio: "Lawns",
    businessLogo: "",
    caseImages: [],
    profileSkipped: true,
    visitEnabled: false,
    offerEnabled: false,
    invoiceEnabled: false,
    now: NOW,
  });
  const settings = readQuoteSettings(database, "prd");
  assert.equal(settings?.businessName, "");
  assert.equal(publicBusinessName({ skipped: true, businessName: "", displayName: "Ava" }), "Ava");
});

test("an existing published quote listing keeps C$1.49 and a new one locks C$4.99", () => {
  assert.equal(listingFeeCents("quote"), 149);
  assert.equal(listingFeeCents("buy"), 149);
  assert.equal(listingFeeCents("file"), 149);
  const database = db();
  database.prepare(`INSERT INTO products (id, cta, status, billing_currency) VALUES ('old', 'quote', 'published', 'USD')`).run();
  database.prepare(`INSERT INTO products (id, cta, status, billing_currency) VALUES ('paused', 'quote', 'draft', 'CAD')`).run();
  ensureQuoteFollowup(database, NOW);
  assert.deepEqual(lockQuoteListingRate(database, "old", NOW), { cents: 149, currency: "USD", legacy: true });
  assert.deepEqual(lockQuoteListingRate(database, "paused", NOW), { cents: 149, currency: "CAD", legacy: true });
  database.prepare(`INSERT INTO products (id, cta, status, billing_currency) VALUES ('fresh', 'quote', 'published', 'CAD')`).run();
  assert.deepEqual(lockQuoteListingRate(database, "fresh", NOW), { cents: QUOTE_LISTING_CENTS, currency: "CAD", legacy: false });
});

test("saving a draft and a failed send do not create a follow-up fee", () => {
  const database = db();
  database.prepare(`INSERT INTO quotes (id, product_id) VALUES ('quo', 'prd')`).run();
  saveFollowupDraft(database, {
    id: "fol",
    quoteId: "quo",
    userId: "usr",
    kind: "visit",
    payload: { date: "2026-12-01" },
    token: "tok",
    now: NOW,
  });
  assert.equal(followupFeeCovered(database, "quo"), false);
  const bills = database.prepare(`SELECT COUNT(*) AS n FROM twig_bills`).get() as { n: number };
  assert.equal(bills.n, 0);
});

test("visit, quote, and invoice on one inquiry create one C$0.50 fee", () => {
  const database = db();
  for (const kind of ["visit", "offer", "invoice"] as const) {
    markFollowupSent(database, saveFollowupDraft(database, {
      id: `fol_${kind}`,
      quoteId: "quo",
      userId: "usr",
      kind,
      payload: { cents: 1000 },
      token: `tok_${kind}`,
      now: NOW,
    }).id, NOW);
    recordFollowupFee(database, { quoteId: "quo", userId: "usr", productId: "prd", kind, billId: `bill_${kind}`, now: NOW });
  }
  const bills = database.prepare(`SELECT COUNT(*) AS n, SUM(amount_cents) AS cents FROM twig_bills`).get() as { n: number; cents: number };
  assert.equal(bills.n, 1);
  assert.equal(bills.cents, QUOTE_FOLLOWUP_CENTS);
  assert.equal(recordFollowupFee(database, { quoteId: "quo", userId: "usr", productId: "prd", kind: "offer", billId: "again", now: NOW }).created, false);
});

test("a failed first send can be retried once, and reconciliation fills a missing fee without doubling it", () => {
  const database = db();
  database.prepare(`INSERT INTO quotes (id, product_id, name) VALUES ('quo', 'prd', 'Ada')`).run();
  const draft = saveFollowupDraft(database, {
    id: "fol",
    quoteId: "quo",
    userId: "usr",
    kind: "offer",
    payload: {},
    token: "tok",
    now: NOW,
  });
  assert.equal(followupFeeCovered(database, "quo"), false);
  assert.equal(markFollowupSent(database, draft.id, NOW), true);
  assert.equal(reconcileFollowupFees(database, "usr", () => "bill_repair", NOW), 1);
  assert.equal(reconcileFollowupFees(database, "usr", () => "bill_repair_2", NOW), 0);
  const bills = database.prepare(`SELECT COUNT(*) AS n FROM twig_bills WHERE event_key = 'followup|quo'`).get() as { n: number };
  assert.equal(bills.n, 1);
});

test("accepting a quote does not mark the invoice paid", () => {
  const database = db();
  const offer = saveFollowupDraft(database, { id: "offer", quoteId: "quo", userId: "usr", kind: "offer", payload: { validDays: 7 }, token: "offer-tok", now: NOW });
  const invoice = saveFollowupDraft(database, { id: "invoice", quoteId: "quo", userId: "usr", kind: "invoice", payload: { cents: 800 }, token: "invoice-tok", now: NOW });
  markFollowupSent(database, offer.id, NOW);
  markFollowupSent(database, invoice.id, NOW);
  assert.equal(setFollowupStatus(database, "offer-tok", "accepted", NOW), true);
  const invoiceRow = database.prepare(`SELECT status FROM quote_followups WHERE id = 'invoice'`).get() as { status: string };
  assert.equal(invoiceRow.status, "sent");
  assert.equal(markInvoicePaid(database, invoice.id, "usr", NOW), true);
  const paid = database.prepare(`SELECT status FROM quote_followups WHERE id = 'invoice'`).get() as { status: string };
  assert.equal(paid.status, "paid");
});

test("five first follow-ups plus the C$4.99 renewal total C$7.49 and do not repeat", () => {
  const database = db();
  database.prepare(
    `INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status, billing_period_key)
     VALUES ('listing', 'usr', 'prd', 'listing', ?, 'CAD', 'due', '2026-12-15')`,
  ).run(QUOTE_LISTING_CENTS);
  for (let index = 0; index < 5; index += 1) {
    const quoteId = `quo_${index}`;
    database.prepare(`INSERT INTO quotes (id, product_id, name) VALUES (?, 'prd', 'Ada')`).run(quoteId);
    const draft = saveFollowupDraft(database, { id: `fol_${index}`, quoteId, userId: "usr", kind: "visit", payload: {}, token: `tok_${index}`, now: NOW });
    markFollowupSent(database, draft.id, NOW);
    recordFollowupFee(database, { quoteId, userId: "usr", productId: "prd", kind: "visit", billId: `bill_${index}`, now: NOW });
  }
  const open = listOpenFollowupFees(database, "usr");
  assert.equal(open.reduce((sum, fee) => sum + fee.amountCents, 0), 250);
  const bills = database.prepare(`SELECT id, kind, currency, amount_cents, status, collection_id, billing_period_key, due_at FROM twig_bills`).all() as Array<{
    id: string; kind: string; currency: string; amount_cents: number; status: string; collection_id: string; billing_period_key: string; due_at: string;
  }>;
  const view = bills.map((bill) => ({
    id: bill.id,
    kind: bill.kind,
    currency: bill.currency,
    amountCents: bill.amount_cents,
    status: bill.status,
    collectionId: bill.collection_id,
    periodKey: bill.billing_period_key,
    dueAt: bill.due_at,
  }));
  const [plan] = previewCollections(view);
  assert.equal(plan.totalCents, 749);
  assert.equal(plan.quoteCents, 250);
  assert.equal(plan.listingCents, 499);
  assert.equal(reconcileFollowupFees(database, "usr", () => "bill_extra", NOW), 0);
  const again = database.prepare(`SELECT COUNT(*) AS n FROM twig_bills WHERE kind = 'quote'`).get() as { n: number };
  assert.equal(again.n, 5);
  assert.equal(previewCollections(view)[0].totalCents, 749);
  const lines = listFollowupFeeLines(database, "usr");
  assert.equal(lines.length, 5);
  assert.equal(lines[0].kind, "visit");
  assert.equal(lines[0].hasBill, true);
  assert.equal(lines[0].billStatus, "pending");
  assert.equal(lines[0].customerName, "Ada");
  database.prepare(`DELETE FROM twig_bills WHERE id = ?`).run(lines[0].billId);
  const missing = listFollowupFeeLines(database, "usr").find((line) => line.quoteId === lines[0].quoteId);
  assert.equal(missing?.hasBill, false);
});
