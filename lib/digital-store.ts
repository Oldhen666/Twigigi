import { DatabaseSync } from "node:sqlite";
import { firstCoverage, nextPeriodBill } from "@/lib/billing-calendar";
import {
  type DigitalPlanId,
  type DigitalSubscription,
  parseDigitalEvent,
  planChange,
  quoteDigitalPlan,
  subscriptionCovers,
} from "@/lib/digital-plans";
import { graceDeadline } from "@/lib/listing-cycle";

type SqlRow = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "");
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function one(database: DatabaseSync, sql: string, ...params: Array<string | number>) {
  return (database.prepare(sql).get(...params) as SqlRow | undefined) ?? null;
}

function rows(database: DatabaseSync, sql: string, ...params: Array<string | number>) {
  return database.prepare(sql).all(...params) as SqlRow[];
}

export function ensureDigitalStore(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS digital_subscriptions (
      user_id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL DEFAULT '',
      copies INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '',
      paid_until TEXT NOT NULL DEFAULT '',
      anchor_day INTEGER NOT NULL DEFAULT 0,
      auto_renew INTEGER NOT NULL DEFAULT 1,
      grace_until TEXT NOT NULL DEFAULT '',
      pending_plan_id TEXT NOT NULL DEFAULT '',
      pending_copies INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'CAD',
      updated_at TEXT NOT NULL DEFAULT ''
    );
  `);
  const columns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "event_key")) {
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS twig_bills_digital_plan_event
      ON twig_bills(event_key)
      WHERE kind = 'digital_plan' AND event_key != '';
    `);
  }
}

function mapSubscription(row: SqlRow | null): DigitalSubscription | null {
  if (!row) return null;
  return {
    userId: text(row.user_id),
    planId: text(row.plan_id),
    copies: num(row.copies),
    status: text(row.status),
    paidUntil: text(row.paid_until),
    anchorDay: num(row.anchor_day),
    autoRenew: num(row.auto_renew) === 1,
    graceUntil: text(row.grace_until),
    pendingPlanId: text(row.pending_plan_id),
    pendingCopies: num(row.pending_copies),
    currency: text(row.currency) || "CAD",
  };
}

export function readDigitalSubscriptionRow(database: DatabaseSync, userId: string) {
  ensureDigitalStore(database);
  return mapSubscription(one(database, `SELECT * FROM digital_subscriptions WHERE user_id = ?`, userId));
}

export function countPublishedDigitalFiles(database: DatabaseSync, userId: string) {
  const row = one(
    database,
    `SELECT COUNT(*) AS n FROM products WHERE user_id = ? AND cta = 'file' AND status = 'published' AND fee_exempt = 0`,
    userId,
  );
  return num(row?.n);
}

export type FilePublishResult =
  | { ok: true }
  | { ok: false; reason: "no_plan" | "quota" | "missing"; limit: number | null; published: number };

export function claimFilePublish(database: DatabaseSync, productId: string, userId: string, now: string): FilePublishResult {
  ensureDigitalStore(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    const product = one(database, `SELECT id, user_id, cta, status, fee_exempt FROM products WHERE id = ? AND user_id = ?`, productId, userId);
    if (!product || text(product.cta) !== "file") {
      database.exec("ROLLBACK");
      return { ok: false, reason: "missing", limit: null, published: 0 };
    }
    if (text(product.status) === "published") {
      database.exec("COMMIT");
      return { ok: true };
    }
    if (num(product.fee_exempt) === 1) {
      const updated = database.prepare(
        `UPDATE products
         SET status = 'published', deactivates_at = NULL, deactivated_at = NULL, updated_at = ?
         WHERE id = ? AND user_id = ? AND cta = 'file' AND status IN ('draft', 'deactivated')`,
      ).run(now, productId, userId);
      if (updated.changes < 1) {
        database.exec("ROLLBACK");
        return { ok: false, reason: "missing", limit: null, published: 0 };
      }
      database.exec("COMMIT");
      return { ok: true };
    }
    const published = countPublishedDigitalFiles(database, userId);
    const sub = readDigitalSubscriptionRow(database, userId);
    const quote = subscriptionCovers(sub, Date.parse(now)) && sub ? quoteDigitalPlan(sub.planId, sub.copies) : null;
    if (!quote) {
      database.exec("ROLLBACK");
      return { ok: false, reason: "no_plan", limit: null, published };
    }
    if (quote.listingLimit != null && published >= quote.listingLimit) {
      database.exec("ROLLBACK");
      return { ok: false, reason: "quota", limit: quote.listingLimit, published };
    }
    const updated = database.prepare(
      `UPDATE products
       SET status = 'published', deactivates_at = NULL, deactivated_at = NULL, updated_at = ?
       WHERE id = ? AND user_id = ? AND cta = 'file' AND status IN ('draft', 'deactivated')`,
    ).run(now, productId, userId);
    if (updated.changes < 1) {
      database.exec("ROLLBACK");
      return { ok: false, reason: "missing", limit: quote.listingLimit, published };
    }
    database.exec("COMMIT");
    return { ok: true };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function openPlanBill(database: DatabaseSync, userId: string) {
  return one(
    database,
    `SELECT id, status, collection_id, event_key FROM twig_bills
     WHERE user_id = ? AND kind = 'digital_plan' AND status IN ('pending', 'accrued', 'due', 'recorded', 'processing')
     ORDER BY created_at ASC LIMIT 1`,
    userId,
  );
}

function insertPlanBill(
  database: DatabaseSync,
  input: { id: string; userId: string; amountCents: number; eventKey: string; periodEnd: string; now: string },
) {
  database.prepare(
    `INSERT INTO twig_bills (
      id, user_id, product_id, amount_cents, currency, method, kind, period_start, period_end, status, created_at,
      billing_period_key, event_key, quote_id, due_at, paid_at
    ) VALUES (?, ?, ?, ?, 'CAD', '', 'digital_plan', ?, ?, 'due', ?, ?, ?, '', ?, '')`,
  ).run(
    input.id,
    input.userId,
    `digital:${input.userId}`,
    input.amountCents,
    input.now,
    input.periodEnd,
    input.now,
    input.eventKey,
    input.eventKey,
    input.now,
  );
}

export type PlanCommit =
  | { ok: false; reason: "invalid" | "copies" | "quota" | "pending"; limit: number | null; published: number }
  | { ok: true; kind: "same" | "schedule" | "switch_free"; chargeCents: 0 }
  | { ok: true; kind: "bill"; chargeCents: number; eventKey: string };

export function commitPlanChange(
  database: DatabaseSync,
  input: { id: string; userId: string; planId: string; copies: number; now: string },
): PlanCommit {
  ensureDigitalStore(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    const published = countPublishedDigitalFiles(database, input.userId);
    const current = readDigitalSubscriptionRow(database, input.userId);
    const change = planChange({
      userId: input.userId,
      current,
      planId: input.planId,
      copies: input.copies,
      published,
      now: input.now,
    });
    if (!change.ok) {
      database.exec("ROLLBACK");
      return change;
    }
    const open = openPlanBill(database, input.userId);
    if (open && (change.kind === "bill" || change.kind === "schedule" || change.kind === "switch_free")) {
      if (text(open.status) === "processing" || text(open.collection_id)) {
        database.exec("ROLLBACK");
        return { ok: false, reason: "pending", limit: null, published };
      }
      if (change.kind === "bill" && text(open.event_key) === change.eventKey) {
        database.exec("COMMIT");
        return { ok: true, kind: "bill", chargeCents: change.chargeCents, eventKey: change.eventKey };
      }
      database.prepare(
        `UPDATE twig_bills SET status = 'void'
         WHERE id = ? AND user_id = ? AND kind = 'digital_plan' AND collection_id = '' AND status IN ('pending', 'accrued', 'due', 'recorded')`,
      ).run(text(open.id), input.userId);
    }
    if (change.kind === "same") {
      database.exec("COMMIT");
      return { ok: true, kind: "same", chargeCents: 0 };
    }
    if (change.kind === "schedule") {
      database.prepare(
        `INSERT INTO digital_subscriptions (
          user_id, plan_id, copies, status, paid_until, anchor_day, auto_renew, grace_until, pending_plan_id, pending_copies, currency, updated_at
        ) VALUES (?, ?, ?, 'active', '', 0, 1, '', ?, ?, 'CAD', ?)
        ON CONFLICT(user_id) DO UPDATE SET pending_plan_id = ?, pending_copies = ?, updated_at = ?`,
      ).run(
        input.userId,
        current?.planId || change.planId,
        current?.copies || change.copies,
        change.planId,
        change.copies,
        input.now,
        change.planId,
        change.copies,
        input.now,
      );
      database.exec("COMMIT");
      return { ok: true, kind: "schedule", chargeCents: 0 };
    }
    if (change.kind === "switch_free") {
      database.prepare(
        `UPDATE digital_subscriptions
         SET plan_id = ?, copies = ?, pending_plan_id = '', pending_copies = 0, updated_at = ?
         WHERE user_id = ?`,
      ).run(change.planId, change.copies, input.now, input.userId);
      database.exec("COMMIT");
      return { ok: true, kind: "switch_free", chargeCents: 0 };
    }
    try {
      insertPlanBill(database, {
        id: input.id,
        userId: input.userId,
        amountCents: change.chargeCents,
        eventKey: change.eventKey,
        periodEnd: change.periodEnd,
        now: input.now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("UNIQUE")) throw error;
    }
    database.exec("COMMIT");
    return { ok: true, kind: "bill", chargeCents: change.chargeCents, eventKey: change.eventKey };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function cancelPlanRenewal(database: DatabaseSync, userId: string, now: string) {
  ensureDigitalStore(database);
  database.prepare(
    `UPDATE digital_subscriptions
     SET auto_renew = 0, pending_plan_id = '', pending_copies = 0, updated_at = ?
     WHERE user_id = ? AND status IN ('active', 'grace')`,
  ).run(now, userId);
}

function writeSubscription(
  database: DatabaseSync,
  input: { userId: string; planId: DigitalPlanId; copies: number; paidUntil: string; anchorDay: number; now: string; keepAnchor: boolean },
) {
  database.prepare(
    `INSERT INTO digital_subscriptions (
      user_id, plan_id, copies, status, paid_until, anchor_day, auto_renew, grace_until, pending_plan_id, pending_copies, currency, updated_at
    ) VALUES (?, ?, ?, 'active', ?, ?, 1, '', '', 0, 'CAD', ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan_id = ?,
      copies = ?,
      status = 'active',
      paid_until = ?,
      anchor_day = CASE WHEN ? = 1 AND anchor_day IN (15, 28) THEN anchor_day ELSE ? END,
      auto_renew = 1,
      grace_until = '',
      pending_plan_id = '',
      pending_copies = 0,
      updated_at = ?`,
  ).run(
    input.userId,
    input.planId,
    input.copies,
    input.paidUntil,
    input.anchorDay,
    input.now,
    input.planId,
    input.copies,
    input.paidUntil,
    input.keepAnchor ? 1 : 0,
    input.anchorDay,
    input.now,
  );
}

export function applyDigitalPlanPayment(database: DatabaseSync, input: { userId: string; collectionId: string; paidAt: string }) {
  const columns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "event_key")) return;
  ensureDigitalStore(database);
  const bills = rows(
    database,
    `SELECT event_key, period_end FROM twig_bills
     WHERE collection_id = ? AND user_id = ? AND kind = 'digital_plan'`,
    input.collectionId,
    input.userId,
  );
  for (const bill of bills) {
    const parsed = parseDigitalEvent(text(bill.event_key));
    if (!parsed) continue;
    if (parsed.mode === "first") {
      const coverage = firstCoverage(input.paidAt);
      if (!coverage?.periodEnd) continue;
      writeSubscription(database, {
        userId: input.userId,
        planId: parsed.planId,
        copies: parsed.copies,
        paidUntil: coverage.periodEnd,
        anchorDay: coverage.anchor,
        now: input.paidAt,
        keepAnchor: false,
      });
      continue;
    }
    const current = readDigitalSubscriptionRow(database, input.userId);
    const paidUntil = parsed.mode === "renew" ? text(bill.period_end) : current?.paidUntil || text(bill.period_end);
    writeSubscription(database, {
      userId: input.userId,
      planId: parsed.planId,
      copies: parsed.copies,
      paidUntil,
      anchorDay: current?.anchorDay || 0,
      now: input.paidAt,
      keepAnchor: true,
    });
  }
}

export function failDigitalPlanPayment(database: DatabaseSync, input: { userId: string; collectionId: string; failedAt: string }) {
  const columns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "kind")) return;
  const bill = one(
    database,
    `SELECT id FROM twig_bills WHERE collection_id = ? AND user_id = ? AND kind = 'digital_plan' LIMIT 1`,
    input.collectionId,
    input.userId,
  );
  if (!bill) return;
  ensureDigitalStore(database);
  database.prepare(
    `UPDATE digital_subscriptions
     SET status = 'grace', grace_until = ?, updated_at = ?
     WHERE user_id = ? AND status = 'active'`,
  ).run(graceDeadline(input.failedAt), input.failedAt, input.userId);
}

export function accruePlanRenewal(database: DatabaseSync, input: { id: string; userId: string; now: string }) {
  ensureDigitalStore(database);
  const sub = readDigitalSubscriptionRow(database, input.userId);
  if (!sub) return false;
  const nowMs = Date.parse(input.now);
  if (sub.status === "grace") {
    const ends = Date.parse(sub.graceUntil);
    if (!Number.isFinite(ends) || ends <= nowMs) {
      database.prepare(`UPDATE digital_subscriptions SET status = 'paused', updated_at = ? WHERE user_id = ? AND status = 'grace'`).run(input.now, input.userId);
    }
  }
  if (sub.status === "active" && !sub.autoRenew) {
    const until = Date.parse(sub.paidUntil);
    if (Number.isFinite(until) && until <= nowMs) {
      database.prepare(`UPDATE digital_subscriptions SET status = 'canceled', updated_at = ? WHERE user_id = ? AND status = 'active'`).run(input.now, input.userId);
    }
    return false;
  }
  if (sub.status !== "active" || !sub.autoRenew) return false;
  const until = Date.parse(sub.paidUntil);
  if (!Number.isFinite(until) || until > nowMs) return false;
  const planId = sub.pendingPlanId || sub.planId;
  const copies = sub.pendingCopies || sub.copies;
  const quote = quoteDigitalPlan(planId, copies);
  const next = nextPeriodBill({ paidUntil: sub.paidUntil });
  if (!quote || !next) return false;
  const eventKey = `digital|renew|${quote.plan.id}|${quote.copies}|${input.userId}|${next.periodKey}`;
  const existing = one(
    database,
    `SELECT id FROM twig_bills WHERE user_id = ? AND kind = 'digital_plan' AND event_key = ? AND status != 'void'`,
    input.userId,
    eventKey,
  );
  if (existing) return false;
  insertPlanBill(database, {
    id: input.id,
    userId: input.userId,
    amountCents: quote.monthlyCents,
    eventKey,
    periodEnd: next.periodEnd,
    now: input.now,
  });
  return true;
}

export type LegacyDigitalBilling = {
  publishedFileListings: number;
  fileListingsWithListingBills: number;
  openUnpaidFileListingBills: number;
  openUnpaidFileListingCents: number;
  paidFileListingBills: number;
  paidFileListingCents: number;
};

export function legacyDigitalFileBilling(database: DatabaseSync, userId = ""): LegacyDigitalBilling {
  const owner = userId ? " AND p.user_id = ?" : "";
  const params = userId ? [userId] : [];
  const published = one(database, `SELECT COUNT(*) AS n FROM products p WHERE p.cta = 'file' AND p.status = 'published' AND p.fee_exempt = 0${owner}`, ...params);
  const withBills = one(
    database,
    `SELECT COUNT(DISTINCT p.id) AS n
     FROM products p JOIN twig_bills b ON b.product_id = p.id
     WHERE p.cta = 'file' AND b.kind = 'listing' AND b.status != 'void'${owner}`,
    ...params,
  );
  const open = one(
    database,
    `SELECT COUNT(*) AS n, COALESCE(SUM(b.amount_cents), 0) AS cents
     FROM twig_bills b JOIN products p ON p.id = b.product_id
     WHERE p.cta = 'file' AND b.kind = 'listing' AND b.status IN ('pending', 'accrued', 'due', 'recorded', 'processing')${owner}`,
    ...params,
  );
  const paid = one(
    database,
    `SELECT COUNT(*) AS n, COALESCE(SUM(b.amount_cents), 0) AS cents
     FROM twig_bills b JOIN products p ON p.id = b.product_id
     WHERE p.cta = 'file' AND b.kind = 'listing' AND b.status = 'paid'${owner}`,
    ...params,
  );
  return {
    publishedFileListings: num(published?.n),
    fileListingsWithListingBills: num(withBills?.n),
    openUnpaidFileListingBills: num(open?.n),
    openUnpaidFileListingCents: num(open?.cents),
    paidFileListingBills: num(paid?.n),
    paidFileListingCents: num(paid?.cents),
  };
}
