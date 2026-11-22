import { DatabaseSync } from "node:sqlite";
import {
  QUOTE_FEE_CURRENCY,
  QUOTE_FOLLOWUP_CENTS,
  QUOTE_LEGACY_LISTING_CENTS,
  QUOTE_LISTING_CENTS,
  followupEventKey,
  quoteListingCharge,
  type QuoteTool,
} from "@/lib/quote-followup";

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

export type QuoteTwigSettings = {
  productId: string;
  businessName: string;
  businessBio: string;
  businessLogo: string;
  caseImages: string[];
  profileSkipped: boolean;
  visitEnabled: boolean;
  offerEnabled: boolean;
  invoiceEnabled: boolean;
  listingRateCents: number;
  listingCurrency: string;
};

export type QuoteFollowup = {
  id: string;
  quoteId: string;
  userId: string;
  kind: QuoteTool;
  version: number;
  status: string;
  payload: Record<string, string | number>;
  token: string;
  sentAt: string;
  createdAt: string;
};

export function ensureQuoteFollowup(database: DatabaseSync, now = new Date().toISOString()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS quote_twig_settings (
      product_id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL DEFAULT '',
      business_bio TEXT NOT NULL DEFAULT '',
      business_logo TEXT NOT NULL DEFAULT '',
      case_images_json TEXT NOT NULL DEFAULT '[]',
      profile_skipped INTEGER NOT NULL DEFAULT 0,
      visit_enabled INTEGER NOT NULL DEFAULT 0,
      offer_enabled INTEGER NOT NULL DEFAULT 0,
      invoice_enabled INTEGER NOT NULL DEFAULT 0,
      listing_rate_cents INTEGER NOT NULL DEFAULT 0,
      listing_currency TEXT NOT NULL DEFAULT 'CAD',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS quote_followups (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      token TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS quote_followups_token ON quote_followups(token);
    CREATE TABLE IF NOT EXISTS quote_followup_fees (
      quote_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      bill_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  database.exec(`CREATE TABLE IF NOT EXISTS quote_followup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const columns = database.prepare(`PRAGMA table_info(products)`).all() as Array<{ name: string }>;
  const grandfathered = one(database, `SELECT value FROM quote_followup_meta WHERE key = 'listing_grandfather'`);
  if (!grandfathered && columns.some((column) => column.name === "cta")) {
    database.prepare(
      `INSERT INTO quote_twig_settings (product_id, offer_enabled, listing_rate_cents, listing_currency, updated_at)
       SELECT id, 1, ?, CASE WHEN billing_currency IN ('CAD', 'USD') THEN billing_currency ELSE 'CAD' END, ?
       FROM products
       WHERE cta = 'quote'
       ON CONFLICT(product_id) DO NOTHING`,
    ).run(QUOTE_LEGACY_LISTING_CENTS, now);
    database.prepare(`INSERT INTO quote_followup_meta (key, value) VALUES ('listing_grandfather', ?)`).run(now);
  }
  const billColumns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  if (billColumns.some((column) => column.name === "event_key")) {
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS twig_bills_quote_event
      ON twig_bills(event_key)
      WHERE kind = 'quote' AND event_key != '';
    `);
  }
}

function parseImages(raw: string) {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.startsWith("/uploads/")).slice(0, 4);
  } catch {
    return [];
  }
}

function mapSettings(row: SqlRow): QuoteTwigSettings {
  return {
    productId: text(row.product_id),
    businessName: text(row.business_name),
    businessBio: text(row.business_bio),
    businessLogo: text(row.business_logo),
    caseImages: parseImages(text(row.case_images_json)),
    profileSkipped: num(row.profile_skipped) === 1,
    visitEnabled: num(row.visit_enabled) === 1,
    offerEnabled: num(row.offer_enabled) === 1,
    invoiceEnabled: num(row.invoice_enabled) === 1,
    listingRateCents: num(row.listing_rate_cents),
    listingCurrency: text(row.listing_currency) || QUOTE_FEE_CURRENCY,
  };
}

export function readQuoteSettings(database: DatabaseSync, productId: string): QuoteTwigSettings | null {
  ensureQuoteFollowup(database);
  const row = one(database, `SELECT * FROM quote_twig_settings WHERE product_id = ?`, productId);
  return row ? mapSettings(row) : null;
}

export function saveQuoteSettings(
  database: DatabaseSync,
  input: {
    productId: string;
    businessName: string;
    businessBio: string;
    businessLogo: string;
    caseImages: string[];
    profileSkipped: boolean;
    visitEnabled: boolean;
    offerEnabled: boolean;
    invoiceEnabled: boolean;
    now: string;
  },
) {
  ensureQuoteFollowup(database);
  const images = JSON.stringify(input.caseImages.slice(0, 4));
  database.prepare(
    `INSERT INTO quote_twig_settings (
      product_id, business_name, business_bio, business_logo, case_images_json, profile_skipped,
      visit_enabled, offer_enabled, invoice_enabled, listing_rate_cents, listing_currency, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'CAD', ?)
    ON CONFLICT(product_id) DO UPDATE SET
      business_name = excluded.business_name,
      business_bio = excluded.business_bio,
      business_logo = excluded.business_logo,
      case_images_json = excluded.case_images_json,
      profile_skipped = excluded.profile_skipped,
      visit_enabled = excluded.visit_enabled,
      offer_enabled = excluded.offer_enabled,
      invoice_enabled = excluded.invoice_enabled,
      updated_at = excluded.updated_at`,
  ).run(
    input.productId,
    input.profileSkipped ? "" : input.businessName,
    input.profileSkipped ? "" : input.businessBio,
    input.profileSkipped ? "" : input.businessLogo,
    input.profileSkipped ? "[]" : images,
    input.profileSkipped ? 1 : 0,
    input.visitEnabled ? 1 : 0,
    input.offerEnabled ? 1 : 0,
    input.invoiceEnabled ? 1 : 0,
    input.now,
  );
}

export function lockQuoteListingRate(database: DatabaseSync, productId: string, now = new Date().toISOString()) {
  ensureQuoteFollowup(database);
  const current = readQuoteSettings(database, productId);
  if (current && current.listingRateCents > 0) return quoteListingCharge(current.listingRateCents, current.listingCurrency);
  database.prepare(
    `INSERT INTO quote_twig_settings (product_id, listing_rate_cents, listing_currency, updated_at)
     VALUES (?, ?, 'CAD', ?)
     ON CONFLICT(product_id) DO UPDATE SET
       listing_rate_cents = CASE WHEN listing_rate_cents > 0 THEN listing_rate_cents ELSE excluded.listing_rate_cents END,
       listing_currency = CASE WHEN listing_rate_cents > 0 THEN listing_currency ELSE 'CAD' END,
       updated_at = excluded.updated_at`,
  ).run(productId, QUOTE_LISTING_CENTS, now);
  const saved = readQuoteSettings(database, productId);
  return quoteListingCharge(saved?.listingRateCents || QUOTE_LISTING_CENTS, saved?.listingCurrency || QUOTE_FEE_CURRENCY);
}

function parsePayload(raw: string) {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const payload: Record<string, string | number> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" || typeof item === "number") payload[key] = item;
    }
    return payload;
  } catch {
    return {};
  }
}

function mapFollowup(row: SqlRow): QuoteFollowup {
  const kind = text(row.kind);
  return {
    id: text(row.id),
    quoteId: text(row.quote_id),
    userId: text(row.user_id),
    kind: kind === "visit" || kind === "invoice" ? kind : "offer",
    version: num(row.version),
    status: text(row.status),
    payload: parsePayload(text(row.payload_json)),
    token: text(row.token),
    sentAt: text(row.sent_at),
    createdAt: text(row.created_at),
  };
}

export function listQuoteFollowups(database: DatabaseSync, quoteId: string) {
  ensureQuoteFollowup(database);
  return rows(database, `SELECT * FROM quote_followups WHERE quote_id = ? ORDER BY created_at ASC, version ASC`, quoteId).map(mapFollowup);
}

export function readFollowupByToken(database: DatabaseSync, token: string) {
  ensureQuoteFollowup(database);
  const row = one(database, `SELECT * FROM quote_followups WHERE token = ?`, token);
  return row ? mapFollowup(row) : null;
}

export function followupFeeCovered(database: DatabaseSync, quoteId: string) {
  ensureQuoteFollowup(database);
  return Boolean(one(database, `SELECT quote_id FROM quote_followup_fees WHERE quote_id = ?`, quoteId));
}

export function saveFollowupDraft(
  database: DatabaseSync,
  input: { id: string; quoteId: string; userId: string; kind: QuoteTool; payload: Record<string, string | number>; token: string; now: string },
) {
  ensureQuoteFollowup(database);
  const existing = one(
    database,
    `SELECT id, version FROM quote_followups WHERE quote_id = ? AND kind = ? AND status = 'draft' ORDER BY version DESC LIMIT 1`,
    input.quoteId,
    input.kind,
  );
  if (existing) {
    database.prepare(`UPDATE quote_followups SET payload_json = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(input.payload), input.now, text(existing.id));
    return { id: text(existing.id), version: num(existing.version) };
  }
  const latest = one(database, `SELECT MAX(version) AS version FROM quote_followups WHERE quote_id = ? AND kind = ?`, input.quoteId, input.kind);
  const version = num(latest?.version) + 1;
  database.prepare(
    `INSERT INTO quote_followups (id, quote_id, user_id, kind, version, status, payload_json, token, sent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, '', ?, ?)`,
  ).run(input.id, input.quoteId, input.userId, input.kind, version, JSON.stringify(input.payload), input.token, input.now, input.now);
  return { id: input.id, version };
}

export function markFollowupSent(database: DatabaseSync, id: string, now: string) {
  ensureQuoteFollowup(database);
  const current = one(database, `SELECT quote_id, kind FROM quote_followups WHERE id = ?`, id);
  if (!current) return false;
  database.prepare(
    `UPDATE quote_followups SET status = 'superseded', updated_at = ?
     WHERE quote_id = ? AND kind = ? AND status = 'sent' AND id != ?`,
  ).run(now, text(current.quote_id), text(current.kind), id);
  const result = database.prepare(
    `UPDATE quote_followups SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'`,
  ).run(now, now, id);
  return result.changes > 0;
}

export function recordFollowupFee(
  database: DatabaseSync,
  input: { quoteId: string; userId: string; productId: string; kind: QuoteTool; billId: string; now: string },
) {
  ensureQuoteFollowup(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = one(database, `SELECT bill_id, amount_cents FROM quote_followup_fees WHERE quote_id = ?`, input.quoteId);
    if (existing) {
      database.exec("COMMIT");
      return { created: false, billId: text(existing.bill_id), amountCents: num(existing.amount_cents) };
    }
    database.prepare(
      `INSERT INTO quote_followup_fees (quote_id, user_id, product_id, bill_id, amount_cents, currency, kind, created_at)
       VALUES (?, ?, ?, ?, ?, 'CAD', ?, ?)`,
    ).run(input.quoteId, input.userId, input.productId, input.billId, QUOTE_FOLLOWUP_CENTS, input.kind, input.now);
    const billColumns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
    if (billColumns.length > 0) {
      database.prepare(
        `INSERT INTO twig_bills (
          id, user_id, product_id, amount_cents, currency, method, kind, period_start, period_end, status, created_at,
          billing_period_key, event_key, quote_id, due_at, paid_at
        ) VALUES (?, ?, ?, ?, 'CAD', '', 'quote', ?, '', 'pending', ?, '', ?, ?, '', '')`,
      ).run(
        input.billId,
        input.userId,
        input.productId,
        QUOTE_FOLLOWUP_CENTS,
        input.now,
        input.now,
        followupEventKey(input.quoteId),
        input.quoteId,
      );
    }
    database.exec("COMMIT");
    return { created: true, billId: input.billId, amountCents: QUOTE_FOLLOWUP_CENTS };
  } catch (error) {
    database.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("PRIMARY")) {
      const existing = one(database, `SELECT bill_id, amount_cents FROM quote_followup_fees WHERE quote_id = ?`, input.quoteId);
      if (existing) return { created: false, billId: text(existing.bill_id), amountCents: num(existing.amount_cents) };
    }
    throw error;
  }
}

export function reconcileFollowupFees(database: DatabaseSync, userId: string, billIdFor: (quoteId: string) => string, now: string) {
  ensureQuoteFollowup(database);
  const quoteColumns = database.prepare(`PRAGMA table_info(quotes)`).all() as Array<{ name: string }>;
  if (quoteColumns.length === 0) return 0;
  const missing = rows(
    database,
    `SELECT f.quote_id, f.user_id, f.kind, q.product_id
     FROM quote_followups f
     JOIN quotes q ON q.id = f.quote_id
     WHERE f.user_id = ? AND f.sent_at != ''
       AND NOT EXISTS (SELECT 1 FROM quote_followup_fees fee WHERE fee.quote_id = f.quote_id)
     GROUP BY f.quote_id`,
    userId,
  );
  let added = 0;
  for (const row of missing) {
    const kind = text(row.kind);
    const result = recordFollowupFee(database, {
      quoteId: text(row.quote_id),
      userId: text(row.user_id),
      productId: text(row.product_id),
      kind: kind === "visit" || kind === "invoice" ? kind : "offer",
      billId: billIdFor(text(row.quote_id)),
      now,
    });
    if (result.created) added += 1;
  }
  return added;
}

export function setFollowupStatus(database: DatabaseSync, token: string, status: string, now: string) {
  ensureQuoteFollowup(database);
  const result = database.prepare(
    `UPDATE quote_followups SET status = ?, updated_at = ? WHERE token = ? AND status = 'sent'`,
  ).run(status, now, token);
  return result.changes > 0;
}

export function markInvoicePaid(database: DatabaseSync, id: string, userId: string, now: string) {
  ensureQuoteFollowup(database);
  const result = database.prepare(
    `UPDATE quote_followups SET status = 'paid', updated_at = ? WHERE id = ? AND user_id = ? AND kind = 'invoice' AND status = 'sent'`,
  ).run(now, id, userId);
  return result.changes > 0;
}

export function currentSentFollowup(database: DatabaseSync, quoteId: string, kind: QuoteTool) {
  ensureQuoteFollowup(database);
  const row = one(
    database,
    `SELECT * FROM quote_followups WHERE quote_id = ? AND kind = ? AND status IN ('sent', 'accepted', 'confirmed', 'paid', 'changes', 'reschedule')
     ORDER BY version DESC LIMIT 1`,
    quoteId,
    kind,
  );
  return row ? mapFollowup(row) : null;
}

export type FollowupFeeLine = {
  quoteId: string;
  billId: string;
  amountCents: number;
  currency: string;
  kind: QuoteTool;
  sentAt: string;
  customerName: string;
  title: string;
  billStatus: string;
  hasBill: boolean;
};

export function listFollowupFeeLines(database: DatabaseSync, userId: string): FollowupFeeLine[] {
  ensureQuoteFollowup(database);
  const billColumns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  const quoteColumns = database.prepare(`PRAGMA table_info(quotes)`).all() as Array<{ name: string }>;
  if (quoteColumns.length === 0) return [];
  const bills = billColumns.some((column) => column.name === "id");
  return rows(
    database,
    `SELECT f.quote_id, f.bill_id, f.amount_cents, f.currency, f.kind, f.created_at,
            COALESCE(q.name, '') AS customer_name,
            COALESCE(p.title, '') AS title,
            ${bills ? "COALESCE(b.status, '')" : "''"} AS bill_status,
            ${bills ? "CASE WHEN b.id IS NULL OR b.id = '' THEN 0 ELSE 1 END" : "0"} AS has_bill
     FROM quote_followup_fees f
     LEFT JOIN quotes q ON q.id = f.quote_id
     LEFT JOIN products p ON p.id = f.product_id
     ${bills ? "LEFT JOIN twig_bills b ON b.id = f.bill_id" : ""}
     WHERE f.user_id = ?
     ORDER BY f.created_at ASC, f.quote_id ASC`,
    userId,
  ).map((row) => {
    const kind = text(row.kind);
    return {
      quoteId: text(row.quote_id),
      billId: text(row.bill_id),
      amountCents: num(row.amount_cents),
      currency: text(row.currency) || QUOTE_FEE_CURRENCY,
      kind: kind === "visit" || kind === "invoice" ? kind : "offer",
      sentAt: text(row.created_at),
      customerName: text(row.customer_name),
      title: text(row.title),
      billStatus: text(row.bill_status),
      hasBill: num(row.has_bill) === 1,
    };
  });
}

export function listOpenFollowupFees(database: DatabaseSync, userId: string) {
  ensureQuoteFollowup(database);
  const billColumns = database.prepare(`PRAGMA table_info(twig_bills)`).all() as Array<{ name: string }>;
  if (!billColumns.some((column) => column.name === "event_key")) return [];
  return rows(
    database,
    `SELECT b.id, b.quote_id, b.amount_cents, b.currency, b.status, COALESCE(q.name, '') AS customer_name, COALESCE(p.title, '') AS title
     FROM twig_bills b
     LEFT JOIN quotes q ON q.id = b.quote_id
     LEFT JOIN products p ON p.id = b.product_id
     WHERE b.user_id = ? AND b.kind = 'quote' AND b.event_key LIKE 'followup|%' AND b.status = 'pending' AND b.collection_id = ''
     ORDER BY b.created_at ASC`,
    userId,
  ).map((row) => ({
    id: text(row.id),
    quoteId: text(row.quote_id),
    amountCents: num(row.amount_cents),
    currency: text(row.currency) || QUOTE_FEE_CURRENCY,
    customerName: text(row.customer_name),
    title: text(row.title),
  }));
}
