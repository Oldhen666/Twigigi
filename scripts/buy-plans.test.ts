import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { listingFeeCents } from "../lib/billing.ts";
import {
  BUY_PLANS,
  bundleMonthlyCents,
  buyPlan,
  buyPlanChange,
  optionAllowed,
  listingRecommendationCopy,
  publishBuyOffer,
  publishChoice,
  publishRecommendationCopy,
  quoteBuyPlan,
  buyExpansionCopy,
  recommendBuyTarget,
} from "../lib/buy-plans.ts";
import { claimBuyPublish, commitBuyChange, ensureBuyStore, readBuySubscriptionRow } from "../lib/buy-store.ts";
import { applyPaymentResult, ensurePaymentLedger } from "../lib/payment-ledger.ts";

const NOW = "2026-11-21T16:00:00.000Z";
const PAID_UNTIL = "2099-01-15T00:00:00.000Z";

test("pricing and the server use the same four CAD Buy Now bundles", () => {
  assert.deepEqual(
    BUY_PLANS.map((plan) => [plan.id, plan.name, plan.listings, plan.monthlyCents]),
    [
      ["buy_now_10", "10 Listings", 10, 1299],
      ["buy_now_20", "20 Listings", 20, 2299],
      ["buy_now_50", "50 Listings", 50, 4499],
      ["buy_now_unlimited", "Unlimited", null, 5999],
    ],
  );
});

test("the whole monthly fee is rounded once from the base plan", () => {
  const twenty = buyPlan("buy_now_20");
  const ten = buyPlan("buy_now_10");
  const fifty = buyPlan("buy_now_50");
  assert.ok(twenty && ten && fifty);
  assert.equal(bundleMonthlyCents(twenty, 1), 2414);
  assert.equal(bundleMonthlyCents(twenty, 10), 3449);
  assert.equal(bundleMonthlyCents(ten, 8), 2338);
  assert.notEqual(1299 + 8 * Math.round(1299 / 10), 2338);
  let extra = 0;
  for (let step = 0; step < 10; step += 1) extra += 1;
  assert.equal(bundleMonthlyCents(twenty, extra), bundleMonthlyCents(twenty, 10));
});

function quote(planId: string, extra = 0) {
  const current = quoteBuyPlan(planId, extra);
  assert.ok(current);
  return current;
}

test("18 slots from the 10-listing bundle recommends the 20-listing bundle and saves C$0.39", () => {
  const recommendation = recommendBuyTarget({ current: quote("buy_now_10"), published: 0, addSlots: 8 });
  assert.ok(recommendation);
  assert.equal(recommendation.targetSlots, 18);
  assert.equal(recommendation.stay?.monthlyCents, 2338);
  assert.equal(recommendation.recommended.planId, "buy_now_20");
  assert.equal(recommendation.recommended.extraSlots, 0);
  assert.equal(recommendation.recommended.monthlyCents, 2299);
  assert.equal(recommendation.savingsCents, 39);
});

test("40 slots from the 20-listing bundle recommends the 50-listing bundle and saves C$0.99", () => {
  const recommendation = recommendBuyTarget({ current: quote("buy_now_20"), published: 0, addSlots: 20 });
  assert.ok(recommendation);
  assert.equal(recommendation.recommended.planId, "buy_now_50");
  assert.equal(recommendation.recommended.monthlyCents, 4499);
  assert.equal(recommendation.stay?.monthlyCents, 4598);
  assert.equal(recommendation.savingsCents, 99);
});

test("66 slots stays on the 50-listing bundle, and 67 slots recommends Unlimited", () => {
  const sixtySix = recommendBuyTarget({ current: quote("buy_now_50"), published: 0, addSlots: 16 });
  assert.ok(sixtySix);
  assert.equal(sixtySix.recommended.planId, "buy_now_50");
  assert.equal(sixtySix.recommended.extraSlots, 16);
  assert.equal(sixtySix.recommended.monthlyCents, 5939);
  assert.equal(sixtySix.unlimited?.monthlyCents, 5999);
  assert.equal(sixtySix.savingsCents, 0);
  const sixtySeven = recommendBuyTarget({ current: quote("buy_now_50"), published: 0, addSlots: 17 });
  assert.ok(sixtySeven);
  assert.equal(sixtySeven.stay?.monthlyCents, 6029);
  assert.equal(sixtySeven.stay?.purchasable, false);
  assert.equal(sixtySeven.recommended.planId, "buy_now_unlimited");
  assert.equal(sixtySeven.recommended.monthlyCents, 5999);
  assert.equal(sixtySeven.savingsCents, 30);
  assert.equal(optionAllowed(sixtySeven, "buy_now_50", 17), false);
  assert.equal(optionAllowed(sixtySeven, "buy_now_unlimited", 0), true);
});

test("a higher bundle prices the remaining slots at that bundle's rate", () => {
  const recommendation = recommendBuyTarget({ current: quote("buy_now_10", 5), published: 15, addSlots: 10 });
  assert.ok(recommendation);
  assert.equal(recommendation.targetSlots, 25);
  assert.equal(recommendation.recommended.planId, "buy_now_20");
  assert.equal(recommendation.recommended.extraSlots, 5);
  assert.equal(recommendation.recommended.monthlyCents, 2874);
  assert.notEqual(recommendation.recommended.monthlyCents, quote("buy_now_10", 15).monthlyCents);
  const larger = recommendBuyTarget({ current: quote("buy_now_20"), published: 0, addSlots: 46 });
  assert.ok(larger);
  assert.equal(larger.targetSlots, 66);
  assert.equal(larger.recommended.planId, "buy_now_50");
  assert.equal(larger.recommended.extraSlots, 16);
  assert.equal(larger.recommended.monthlyCents, 5939);
});

test("60 slots plus 10 recommends Unlimited and saves C$3.00 against the current expansion", () => {
  const recommendation = recommendBuyTarget({ current: quote("buy_now_50", 10), published: 60, addSlots: 10 });
  assert.ok(recommendation);
  assert.equal(recommendation.targetSlots, 70);
  assert.equal(recommendation.stay?.monthlyCents, 6299);
  assert.equal(recommendation.recommended.planId, "buy_now_unlimited");
  assert.equal(recommendation.savingsCents, 300);
});

test("opening a recommendation does not write a bill", () => {
  const db = shopDb();
  recommendBuyTarget({ current: quote("buy_now_10"), published: 0, addSlots: 10 });
  const rows = db.prepare(`SELECT COUNT(*) AS n FROM twig_bills`).get() as { n: number };
  assert.equal(rows.n, 0);
});

test("quote and digital listing fees stay C$1.49, and those listings are not published by a Buy Now claim", () => {
  assert.equal(listingFeeCents("buy"), 149);
  assert.equal(listingFeeCents("quote"), 149);
  assert.equal(listingFeeCents("file"), 149);
  const db = shopDb();
  db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES ('quote_1', 'usr', 'quote', 'draft')`).run();
  db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES ('file_1', 'usr', 'file', 'draft')`).run();
  assert.equal(claimBuyPublish(db, "quote_1", "usr", NOW).ok, false);
  assert.equal(claimBuyPublish(db, "file_1", "usr", NOW).ok, false);
  const statuses = db.prepare(`SELECT id, status FROM products ORDER BY id`).all() as Array<{ id: string; status: string }>;
  assert.deepEqual(statuses.map((row) => [row.id, row.status]), [
    ["file_1", "draft"],
    ["quote_1", "draft"],
  ]);
});

test("a draft stays a draft when the bundle is full, and a deactivated Buy Now listing needs a free slot", () => {
  const db = shopDb();
  seedBundle(db, "buy_now_10", 0);
  for (let index = 0; index < 10; index += 1) {
    db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES (?, 'usr', 'buy', 'published')`).run(`live_${index}`);
  }
  db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES ('draft_1', 'usr', 'buy', 'draft')`).run();
  const blocked = claimBuyPublish(db, "draft_1", "usr", NOW);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, "quota");
  assert.equal((db.prepare(`SELECT status FROM products WHERE id = 'draft_1'`).get() as { status: string }).status, "draft");
  db.prepare(`UPDATE products SET status = 'deactivated' WHERE id = 'live_0'`).run();
  const republished = claimBuyPublish(db, "live_0", "usr", NOW);
  assert.equal(republished.ok, true);
  const again = claimBuyPublish(db, "draft_1", "usr", NOW);
  assert.equal(again.ok, false);
});

test("a rejected change and a failed payment keep the original bundle, slots, and draft", () => {
  const db = shopDb();
  seedBundle(db, "buy_now_50", 0);
  db.prepare(`INSERT INTO products (id, user_id, cta, status) VALUES ('draft_1', 'usr', 'buy', 'draft')`).run();
  const rejected = commitBuyChange(db, { id: "bill_high", userId: "usr", planId: "buy_now_50", extraSlots: 17, now: NOW });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.reason, "extra");
  const before = readBuySubscriptionRow(db, "usr");
  assert.equal(before?.extraSlots, 0);
  assert.equal(before?.planId, "buy_now_50");
  const opened = commitBuyChange(db, { id: "bill_add", userId: "usr", planId: "buy_now_50", extraSlots: 1, now: NOW });
  assert.equal(opened.ok && opened.kind === "bill" && opened.chargeCents, 90);
  ensurePaymentLedger(db);
  db.prepare(
    `INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at)
     VALUES ('col_fail', 'usr', 'CAD', 90, 'processing', 'buy-now-plan-fail', ?)`,
  ).run(NOW);
  db.prepare(`UPDATE twig_bills SET collection_id = 'col_fail', status = 'processing' WHERE id = 'bill_add'`).run();
  const failed = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_fail",
    eventId: "evt_fail",
    userId: "usr",
    collectionId: "col_fail",
    paidAt: NOW,
    succeeded: false,
  });
  assert.equal(failed.outcome, "failed");
  const after = readBuySubscriptionRow(db, "usr");
  assert.equal(after?.planId, "buy_now_50");
  assert.equal(after?.extraSlots, 0);
  assert.equal((db.prepare(`SELECT status FROM products WHERE id = 'draft_1'`).get() as { status: string }).status, "draft");
});

test("payment confirmation stores the bundle once and leaves an old listing bill unchanged", () => {
  const db = shopDb();
  const opened = commitBuyChange(db, { id: "bill_first", userId: "usr", planId: "buy_now_20", extraSlots: 1, now: NOW });
  assert.equal(opened.ok && opened.kind === "bill" && opened.chargeCents, 2414);
  const tampered = buyPlanChange({
    userId: "usr",
    current: null,
    planId: "buy_now_20",
    extraSlots: 1,
    published: 0,
    now: NOW,
  });
  assert.equal(tampered.ok && tampered.kind === "bill" && tampered.chargeCents, 2414);
  db.prepare(`INSERT INTO twig_bills (id, user_id, product_id, kind, amount_cents, currency, status) VALUES ('old', 'usr', 'buy_old', 'listing', 149, 'CAD', 'paid')`).run();
  ensurePaymentLedger(db);
  db.prepare(
    `INSERT INTO fee_collections (id, user_id, currency, amount_cents, status, idempotency_key, created_at)
     VALUES ('col_1', 'usr', 'CAD', 2414, 'processing', 'buy-now-plan-test', ?)`,
  ).run(NOW);
  db.prepare(`UPDATE twig_bills SET collection_id = 'col_1', status = 'processing' WHERE id = 'bill_first'`).run();
  const paid = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_buy",
    eventId: "evt_1",
    userId: "usr",
    collectionId: "col_1",
    paidAt: NOW,
    succeeded: true,
  });
  assert.equal(paid.outcome, "paid");
  const again = applyPaymentResult(db, {
    provider: "stripe",
    transactionId: "pi_buy",
    eventId: "evt_2",
    userId: "usr",
    collectionId: "col_1",
    paidAt: "2026-11-21T16:05:00.000Z",
    succeeded: true,
  });
  assert.equal(again.outcome, "duplicate");
  const sub = readBuySubscriptionRow(db, "usr");
  assert.equal(sub?.planId, "buy_now_20");
  assert.equal(sub?.extraSlots, 1);
  const old = db.prepare(`SELECT amount_cents, status FROM twig_bills WHERE id = 'old'`).get() as { amount_cents: number; status: string };
  assert.equal(old.amount_cents, 149);
  assert.equal(old.status, "paid");
  const repeated = commitBuyChange(db, { id: "bill_again", userId: "usr", planId: "buy_now_20", extraSlots: 1, now: NOW });
  assert.equal(repeated.ok && repeated.kind === "same" && repeated.chargeCents, 0);
});

test("moving to a cheaper bundle applies immediately and does not create a charge", () => {
  const db = shopDb();
  seedBundle(db, "buy_now_10", 8);
  const before = db.prepare(`SELECT COUNT(*) AS n FROM twig_bills`).get() as { n: number };
  const moved = commitBuyChange(db, { id: "bill_free", userId: "usr", planId: "buy_now_20", extraSlots: 0, now: NOW });
  assert.equal(moved.ok && moved.kind === "switch_free" && moved.chargeCents, 0);
  const sub = readBuySubscriptionRow(db, "usr");
  assert.equal(sub?.planId, "buy_now_20");
  assert.equal(sub?.extraSlots, 0);
  const after = db.prepare(`SELECT COUNT(*) AS n FROM twig_bills`).get() as { n: number };
  assert.equal(after.n, before.n);
});

function shopDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY, user_id TEXT, cta TEXT, status TEXT,
      deactivates_at TEXT, deactivated_at TEXT, updated_at TEXT
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

test("publishing one new Twig stays on the C$1.49 listing fee and recommends the 10-listing plan", () => {
  const offer = publishBuyOffer({ current: null, published: 0 });
  assert.equal(offer.included, false);
  assert.equal(offer.neededSlots, 1);
  assert.equal(offer.baseline, null);
  assert.equal(offer.recommendation?.kind, "more");
  assert.equal(offer.recommendation?.option.planId, "buy_now_10");
  assert.equal(offer.recommendation?.option.monthlyCents, 1299);
  assert.equal(offer.recommendation?.addedSlots, 9);
  assert.equal(
    listingRecommendationCopy(offer.recommendation!, 1),
    "The 10-listing plan is C$11.50/month more and includes 9 more listing slots than publishing this Twig for C$1.49.",
  );
  assert.deepEqual(offer.options.map((option) => option.planId), ["buy_now_10", "buy_now_20", "buy_now_50", "buy_now_unlimited"]);
  assert.equal(publishChoice("", offer), null);
  assert.equal(publishChoice("buy_now_20:0", offer)?.planId, "buy_now_20");
});

test("eleven Buy Now listings recommend a bundle that costs less than C$1.49 each", () => {
  const offer = publishBuyOffer({ current: null, published: 10 });
  assert.equal(offer.recommendation?.kind, "save");
  assert.equal(offer.recommendation?.option.planId, "buy_now_10");
  assert.equal(offer.recommendation?.option.extraSlots, 1);
  assert.equal(offer.recommendation?.option.monthlyCents, 1429);
  assert.equal(offer.recommendation?.savingsCents, 210);
  assert.equal(
    listingRecommendationCopy(offer.recommendation!, 11),
    "Switch to the 10-listing plan + 1 slot and save C$2.10/month compared with C$1.49 for each Buy Now Twig.",
  );
});

test("a plan with a free slot includes the Twig at C$0", () => {
  const offer = publishBuyOffer({ current: quote("buy_now_10"), published: 3 });
  assert.equal(offer.included, true);
  assert.equal(offer.baseline, null);
  assert.equal(offer.recommendation, null);
});

test("a full 20-listing plan adds one slot for C$1.15 and totals C$24.14", () => {
  const offer = publishBuyOffer({ current: quote("buy_now_20"), published: 20 });
  assert.ok(offer.baseline);
  assert.equal(offer.baseline.heading, "Add 1 listing slot");
  assert.equal(offer.baseline.extraSlots, 1);
  assert.equal(offer.baseline.monthlyCents, 2414);
  assert.equal(offer.baseline.monthlyCents - 2299, 115);
  const due = buyPlanChange({
    userId: "usr",
    current: {
      userId: "usr",
      planId: "buy_now_20",
      extraSlots: 0,
      status: "active",
      paidUntil: PAID_UNTIL,
      anchorDay: 15,
      autoRenew: true,
      graceUntil: "",
      pendingPlanId: "",
      pendingExtraSlots: 0,
      currency: "CAD",
    },
    planId: "buy_now_20",
    extraSlots: 1,
    published: 20,
    now: NOW,
  });
  assert.equal(due.ok && due.kind === "bill" && due.mode === "add" && due.chargeCents, 115);
  assert.equal(offer.recommendation?.kind, "more");
  assert.equal(offer.recommendation?.option.planId, "buy_now_50");
  assert.equal(
    publishRecommendationCopy(offer.recommendation!, offer.baseline),
    "The 50-listing plan is C$20.85/month more and includes 29 more listing slots than adding 1 slot to your current plan.",
  );
});

test("adding 10 slots to the 10-listing bundle saves C$2.99 on the 20-listing bundle", () => {
  const recommendation = recommendBuyTarget({ current: quote("buy_now_10"), published: 2, addSlots: 10 });
  assert.ok(recommendation);
  assert.equal(recommendation.stay?.monthlyCents, 2598);
  assert.equal(recommendation.recommended.planId, "buy_now_20");
  assert.equal(recommendation.savingsCents, 299);
  assert.equal(
    buyExpansionCopy(recommendation),
    "Save C$2.99/month with the 20-listing bundle, compared with adding 10 slots to your current plan.",
  );
});

test("the 18th slot recommends the 20-listing plan and saves C$0.39", () => {
  const offer = publishBuyOffer({ current: quote("buy_now_10", 7), published: 17 });
  assert.ok(offer.baseline && offer.recommendation);
  assert.equal(offer.baseline.planId, "buy_now_10");
  assert.equal(offer.baseline.extraSlots, 8);
  assert.equal(offer.baseline.monthlyCents, 2338);
  assert.equal(offer.recommendation.kind, "save");
  assert.equal(offer.recommendation.option.heading, "20-listing plan");
  assert.equal(offer.recommendation.option.monthlyCents, 2299);
  assert.equal(offer.recommendation.savingsCents, 39);
  assert.equal(
    publishRecommendationCopy(offer.recommendation, offer.baseline),
    "Save C$0.39/month with the 20-listing bundle, compared with adding 1 slot to your current plan.",
  );
  assert.equal(publishChoice("buy_now_20:0", offer)?.planId, "buy_now_20");
  assert.equal(publishChoice("missing:3", offer)?.planId, offer.baseline.planId);
});

test("an add-on above C$59.99 offers Unlimited and keeps the blocked amount", () => {
  const offer = publishBuyOffer({ current: quote("buy_now_50", 16), published: 66 });
  assert.equal(offer.baseline?.planId, "buy_now_unlimited");
  assert.equal(offer.baseline?.monthlyCents, 5999);
  assert.equal(offer.blockedAddCents, 6029);
});

function seedBundle(db: DatabaseSync, planId: string, extraSlots: number) {
  ensureBuyStore(db);
  db.prepare(
    `INSERT INTO buy_subscriptions (
      user_id, plan_id, extra_slots, status, paid_until, anchor_day, auto_renew, grace_until, pending_plan_id, pending_extra_slots, currency, updated_at
    ) VALUES ('usr', ?, ?, 'active', ?, 15, 1, '', '', 0, 'CAD', ?)`,
  ).run(planId, extraSlots, PAID_UNTIL, NOW);
}
