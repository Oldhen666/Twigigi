import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { listingFeeCents } from "../lib/billing.ts";
import {
  DIGITAL_PLANS,
  planChange,
  platformOrderFeeCents,
  compareDigitalCoverage,
  coveringDigitalQuotes,
  digitalMonthlyTotal,
  quoteDigitalPlan,
  singlePlanAlternative,
  snapshotPlatformFee,
} from "../lib/digital-plans.ts";
import { claimFilePublish, commitPlanChange, countPublishedDigitalFiles, ensureDigitalStore, readDigitalSubscriptionRow } from "../lib/digital-store.ts";
import { applyPaymentResult, ensurePaymentLedger } from "../lib/payment-ledger.ts";

const EXPECTED = [
  ["starter", "Starter", 5, 149, 300, false],
  ["creator", "Creator", 10, 1499, 150, true],
  ["growth", "Growth", 20, 1499, 300, true],
  ["pro", "Pro", 50, 2599, 200, true],
  ["unlimited", "Unlimited", null, 5099, 50, false],
] as const;

test("pricing, dashboard, and server rules read the same five CAD plans", () => {
  assert.deepEqual(
    DIGITAL_PLANS.map((plan) => [plan.id, plan.name, plan.listingsPerCopy, plan.monthlyCents, plan.feeBps, plan.stackable]),
    EXPECTED,
  );
  for (const plan of DIGITAL_PLANS) {
    const quote = quoteDigitalPlan(plan.id, 1);
    assert.ok(quote);
    assert.equal(quote.monthlyCents, plan.monthlyCents);
    assert.equal(quote.feeBps, plan.feeBps);
    assert.equal(quote.listingLimit, plan.listingsPerCopy);
  }
});

test("18 listings at C$1,500 chargeable sales price Creator x2 below Growth", () => {
  const quotes = coveringDigitalQuotes(18);
  const creator = quotes.find((quote) => quote.plan.id === "creator");
  const growth = quotes.find((quote) => quote.plan.id === "growth");
  assert.equal(quotes.some((quote) => quote.plan.id === "starter"), false);
  assert.equal(creator?.copies, 2);
  assert.equal(growth?.copies, 1);
  assert.equal(digitalMonthlyTotal(creator!, 150_000), 5248);
  assert.equal(digitalMonthlyTotal(growth!, 150_000), 5999);
  assert.equal(digitalMonthlyTotal(growth!, 150_000) - digitalMonthlyTotal(creator!, 150_000), 751);
});

test("many listings and low sales follow the lower total, not the lowest order fee", () => {
  const ranked = compareDigitalCoverage(40, 2_000);
  const unlimited = ranked.find((quote) => quote.plan.id === "unlimited");
  assert.equal(ranked[0]?.plan.id, "pro");
  assert.equal(ranked[0]?.copies, 1);
  assert.ok(unlimited);
  assert.ok(ranked[0] && ranked[0].feeBps > unlimited.feeBps);
  assert.ok(ranked[0].totalCents < unlimited.totalCents);
  assert.equal(ranked[0].totalCents, 2639);
  assert.equal(compareDigitalCoverage(18, 150_000)[0]?.plan.id, "creator");
  assert.equal(compareDigitalCoverage(18, 150_000)[0]?.copies, 2);
});

test("stacked copies multiply listings and price once, and keep one order rate", () => {
  const creator = quoteDigitalPlan("creator", 2);
  const growth = quoteDigitalPlan("growth", 2);
  const pro = quoteDigitalPlan("pro", 2);
  assert.ok(creator && growth && pro);
  assert.deepEqual([creator.listingLimit, creator.monthlyCents, creator.feeBps], [20, 2998, 150]);
  assert.deepEqual([growth.listingLimit, growth.monthlyCents, growth.feeBps], [40, 2998, 300]);
  assert.deepEqual([pro.listingLimit, pro.monthlyCents, pro.feeBps], [100, 5198, 200]);
  assert.equal(platformOrderFeeCents(10_000, creator.feeBps), 150);
  assert.equal(quoteDigitalPlan("starter", 2), null);
  assert.equal(quoteDigitalPlan("unlimited", 2), null);
});

test("a single copy is suggested only when listings, price, and fee are all at least as good", () => {
  const growth = quoteDigitalPlan("growth", 2);
  const creator = quoteDigitalPlan("creator", 2);
  assert.ok(growth && creator);
  assert.equal(singlePlanAlternative(growth)?.plan.id, "pro");
  assert.equal(singlePlanAlternative(creator), null);
});

test("Buy now and quote keep the per-listing fee, and only a collectable confirmed digital order stores a platform fee", () => {
  assert.equal(listingFeeCents("buy"), 149);
  assert.equal(listingFeeCents("quote"), 149);
  assert.equal(listingFeeCents("file"), 149);
  const qualified = snapshotPlatformFee({ path: "stripe_connect", amountCents: 10_000, feeBps: 150, planActive: true });
  assert.equal(qualified.feeCents, 150);
  assert.equal(qualified.feeBps, 150);
  assert.equal(qualified.collected, false);
  assert.equal(snapshotPlatformFee({ path: "paypal_checkout", amountCents: 10_000, feeBps: 150, planActive: true }).collected, false);
  assert.deepEqual(
    snapshotPlatformFee({ path: "manual", amountCents: 10_000, feeBps: 150, planActive: true }),
    { feeBps: 0, feeCents: 0, collected: false, reason: snapshotPlatformFee({ path: "manual", amountCents: 1, feeBps: 1, planActive: true }).reason },
  );
  assert.equal(snapshotPlatformFee({ path: "buy_now", amountCents: 10_000, feeBps: 300, planActive: true }).feeCents, 0);
  assert.equal(snapshotPlatformFee({ path: "external", amountCents: 10_000, feeBps: 300, planActive: true }).feeCents, 0);
  assert.equal(snapshotPlatformFee({ path: "quote", amountCents: 10_000, feeBps: 300, planActive: true }).feeCents, 0);
  assert.equal(snapshotPlatformFee({ path: "stripe_connect", amountCents: 10_000, feeBps: 150, planActive: false }).feeCents, 0);
});

function shopDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, user_id TEXT, cta TEXT, status TEXT,
      deactivates_at TEXT, deactivated_at TEXT, updated_at TEXT,
      fee_exempt INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE twig_bills (
      id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, kind TEXT, amount_cents INTEGER, currency TEXT,
      method TEXT DEFAULT '', status TEXT, collection_id TEXT DEFAULT '', billing_period_key TEXT DEFAULT '',
      event_key TEXT DEFAULT '', paid_at TEXT DEFAULT '', charge_key TEXT DEFAULT '',
      period_start TEXT DEFAULT '', period_end TEXT DEFAULT '', due_at TEXT DEFAULT '', quote_id TEXT DEFAULT '',
      created_at TEXT DEFAULT ''
    );
  `);
  return db;
}

test("Starter and Unlimited cannot be changed to two copies", () => {
  const db = shopDb();
  assert.equal(commitPlanChange(db, { id: "bill_s", userId: "usr", planId: "starter", copies: 2, now: "2026-11-21T16:00:00.000Z" }).ok, false);
  assert.equal(commitPlanChange(db, { id: "bill_u", userId: "usr", planId: "unlimited", copies: 2, now: "2026-11-21T16:00:00.000Z" }).ok, false);
  assert.equal(planChange({ userId: "usr", current: null, planId: "starter", copies: 2, published: 0, now: "2026-11-21T16:00:00.000Z" }).ok, false);
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM twig_bills`).get() as { n: number };
  assert.equal(rows.n, 0);
});

test("a draft stays a draft at the listing limit, and one more publish is refused", () => {
  const db = shopDb();
  ensureDigitalStore(db);
  db.prepare(
    `INSERT INTO digital_subscriptions (
      user_id, plan_id, copies, status, paid_until, anchor_day, auto_renew, grace_until, pending_plan_id, pending_copies, currency, updated_at
    ) VALUES ('usr', 'starter', 1, 'active', '2099-01-01T00:00:00.000Z', 15, 1, '', '', 0, 'CAD', '2026-11-21T16:00:00.000Z')`,
  ).run();
  for (let index = 0; index < 5; index += 1) {
    db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES (?, 'usr', 'file', 'published')`).run(`live_${index}`);
  }
  db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES ('draft_1', 'usr', 'file', 'draft')`).run();
  const claimed = claimFilePublish(db, "draft_1", "usr", "2026-11-21T16:00:00.000Z");
  assert.equal(claimed.ok, false);
  if (!claimed.ok) assert.equal(claimed.reason, "quota");
  const status = db.prepare(`SELECT status FROM products WHERE id = 'draft_1'`).get() as { status: string };
  assert.equal(status.status, "draft");
  db.prepare(`INSERT INTO products (id, user_id, cta, status, fee_exempt) VALUES ('waived', 'usr', 'file', 'draft', 1)`).run();
  const waived = claimFilePublish(db, "waived", "usr", "2026-11-21T16:00:00.000Z");
  assert.equal(waived.ok, true);
  assert.equal(countPublishedDigitalFiles(db, "usr"), 5);
});

test("a payment-waived Digital File draft publishes with no plan and does not use a slot", () => {
  const db = shopDb();
  db.prepare(`INSERT INTO products (id, user_id, cta, status, fee_exempt) VALUES ('waived', 'usr', 'file', 'draft', 1)`).run();
  const claimed = claimFilePublish(db, "waived", "usr", "2026-11-21T16:00:00.000Z");
  assert.equal(claimed.ok, true);
  assert.equal((db.prepare(`SELECT status FROM products WHERE id = 'waived'`).get() as { status: string }).status, "published");
  assert.equal(countPublishedDigitalFiles(db, "usr"), 0);
});

test("Creator times two is stored once when the same payment is confirmed again", () => {
  const db = shopDb();
  const opened = commitPlanChange(db, { id: "bill_c", userId: "usr", planId: "creator", copies: 2, now: "2026-11-21T16:00:00.000Z" });
  assert.equal(opened.ok && opened.kind === "bill" && opened.chargeCents, 2998);
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status) VALUES ('old', 'usr', 'file_old', 'listing', 149, 'CAD', 'paid')`).run();
  ensurePaymentLedger(db);
  db.prepare(
    `INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at)
     VALUES ('col_1', 'usr', 'CAD', 2998, 'processing', 'digital-plan-test', '2026-11-21T16:00:00.000Z')`,
  ).run();
  db.prepare(`UPDATE twig_bills SET collection_id = 'col_1', status = 'processing' WHERE id = 'bill_c'`).run();
  const paid = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_plan",
    eventId: "evt_1",
    userId: "usr",
    collectionId: "col_1",
    paidAt: "2026-11-21T16:00:00.000Z",
    succeeded: true,
  });
  assert.equal(paid.outcome, "paid");
  const again = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_plan",
    eventId: "evt_2",
    userId: "usr",
    collectionId: "col_1",
    paidAt: "2026-11-21T16:05:00.000Z",
    succeeded: true,
  });
  assert.equal(again.outcome, "duplicate");
  const sub = readDigitalSubscriptionRow(db, "usr");
  assert.equal(sub?.planId, "creator");
  assert.equal(sub?.copies, 2);
  const old = db.prepare(`SELECT amount_cents, status FROM twig_bills WHERE id = 'old'`).get() as { amount_cents: number; status: string };
  assert.equal(old.amount_cents, 149);
  assert.equal(old.status, "paid");
  const quote = quoteDigitalPlan(sub?.planId || "", sub?.copies || 0);
  assert.equal(quote?.listingLimit, 20);
  assert.equal(quote?.monthlyCents, 2998);
  assert.equal(platformOrderFeeCents(10_000, quote?.feeBps || 0), 150);
});

test("a lower allowance is refused while too many listings are published", () => {
  const current = {
    userId: "usr",
    planId: "growth",
    copies: 2,
    status: "active",
    paidUntil: "2099-01-01T00:00:00.000Z",
    anchorDay: 15,
    autoRenew: true,
    graceUntil: "",
    pendingPlanId: "",
    pendingCopies: 0,
    currency: "CAD",
  };
  const refused = planChange({ userId: "usr", current, planId: "starter", copies: 1, published: 12, now: "2026-11-21T16:00:00.000Z" });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, "quota");
});
