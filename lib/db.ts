import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import {
  journalBalances,
  moneyBucket,
  paymentJournal,
  payoutCompletedJournal,
  payoutJournal,
  splitPayment,
  type LedgerAccount,
  type LedgerDraft,
  type LedgerEntryType,
  type MoneyBucket,
  type OwnerKind,
} from "@/lib/ledger";
import { parseQuoteForm } from "@/lib/quote-form";
import { DEACTIVATION_GRACE_DAYS, addDays } from "@/lib/format";
import { readStoredOptions, readStoredVariants } from "@/lib/variants";
import {
  PROTECTION_DAYS,
  type Cta,
  type Fulfillment,
  type MessageRecord,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
  type PayoutStatus,
  type Product,
  type ProductInput,
  type ProtectionStatus,
  type PublicProduct,
  type PublicSeller,
  type QuoteRecord,
  type SellerStats,
  type User,
  type UserRole,
} from "@/lib/types";

type Row = Record<string, unknown>;

const globalForDb = globalThis as unknown as { twigigiDb?: DatabaseSync };

function openDatabase() {
  const directory = path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "twigigi.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 3000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'seller',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER,
      currency TEXT NOT NULL DEFAULT 'CAD',
      location TEXT NOT NULL DEFAULT '',
      video_url TEXT,
      pickup_enabled INTEGER NOT NULL DEFAULT 0,
      pickup_note TEXT NOT NULL DEFAULT '',
      pickup_time TEXT NOT NULL DEFAULT '',
      delivery_enabled INTEGER NOT NULL DEFAULT 0,
      delivery_radius_km INTEGER,
      delivery_fee_cents INTEGER,
      shipping_enabled INTEGER NOT NULL DEFAULT 0,
      shipping_fee_cents INTEGER,
      shipping_note TEXT NOT NULL DEFAULT '',
      onsite_enabled INTEGER NOT NULL DEFAULT 0,
      remote_enabled INTEGER NOT NULL DEFAULT 0,
      at_location_enabled INTEGER NOT NULL DEFAULT 0,
      quote_form_json TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT 'quote',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      images_json TEXT NOT NULL DEFAULT '[]',
      quantity_available INTEGER,
      button_label TEXT NOT NULL DEFAULT 'Buy now',
      has_options INTEGER NOT NULL DEFAULT 0,
      same_price INTEGER NOT NULL DEFAULT 1,
      options_json TEXT NOT NULL DEFAULT '[]',
      variants_json TEXT NOT NULL DEFAULT '[]',
      require_name INTEGER NOT NULL DEFAULT 1,
      require_email INTEGER NOT NULL DEFAULT 1,
      require_phone INTEGER NOT NULL DEFAULT 1,
      payment_methods TEXT NOT NULL DEFAULT '[]',
      card_payment_url TEXT NOT NULL DEFAULT '',
      interac_email TEXT NOT NULL DEFAULT '',
      venmo_username TEXT NOT NULL DEFAULT '',
      zelle_mode TEXT NOT NULL DEFAULT 'phone',
      zelle_contact TEXT NOT NULL DEFAULT '',
      seller_contact_mode TEXT NOT NULL DEFAULT 'email',
      seller_contact TEXT NOT NULL DEFAULT '',
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deactivates_at TEXT,
      deactivated_at TEXT,
      UNIQUE(user_id, slug)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_nocase ON users(lower(username));

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      public_ref TEXT NOT NULL DEFAULT '',
      product_id TEXT NOT NULL REFERENCES products(id),
      seller_id TEXT NOT NULL DEFAULT '',
      buyer_id TEXT,
      buyer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      fulfillment TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      shipping INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_provider TEXT NOT NULL DEFAULT '',
      provider_payment_id TEXT NOT NULL DEFAULT '',
      paid_at TEXT,
      protection_status TEXT NOT NULL DEFAULT 'pending',
      protection_started_at TEXT,
      protection_days INTEGER NOT NULL DEFAULT 21,
      payout_eligible_at TEXT,
      payout_status TEXT NOT NULL DEFAULT 'none',
      payout_amount INTEGER NOT NULL DEFAULT 0,
      provider_transfer_id TEXT NOT NULL DEFAULT '',
      payout_created_at TEXT,
      payout_completed_at TEXT,
      refund_status TEXT NOT NULL DEFAULT 'none',
      dispute_status TEXT NOT NULL DEFAULT 'none',
      stripe_session_id TEXT,
      src TEXT NOT NULL DEFAULT 'direct',
      variant_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      project_details TEXT NOT NULL DEFAULT '',
      documents_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'new',
      src TEXT NOT NULL DEFAULT 'direct',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      src TEXT NOT NULL DEFAULT 'direct',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      src TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_product ON quotes(product_id);
    CREATE INDEX IF NOT EXISTS idx_messages_product ON messages(product_id);
    CREATE INDEX IF NOT EXISTS idx_views_product ON page_views(product_id);
  `);
  return db;
}

function ensureColumns(database: DatabaseSync) {
  const add = (table: string, column: string, definition: string) => {
    const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };
  add("products", "quantity_available", "quantity_available INTEGER");
  add("products", "button_label", "button_label TEXT NOT NULL DEFAULT 'Buy now'");
  add("products", "has_options", "has_options INTEGER NOT NULL DEFAULT 0");
  add("products", "same_price", "same_price INTEGER NOT NULL DEFAULT 1");
  add("products", "options_json", "options_json TEXT NOT NULL DEFAULT '[]'");
  add("products", "variants_json", "variants_json TEXT NOT NULL DEFAULT '[]'");
  add("products", "require_name", "require_name INTEGER NOT NULL DEFAULT 1");
  add("products", "require_email", "require_email INTEGER NOT NULL DEFAULT 1");
  add("products", "require_phone", "require_phone INTEGER NOT NULL DEFAULT 1");
  add("products", "pickup_time", "pickup_time TEXT NOT NULL DEFAULT ''");
  add("products", "onsite_enabled", "onsite_enabled INTEGER NOT NULL DEFAULT 0");
  add("products", "remote_enabled", "remote_enabled INTEGER NOT NULL DEFAULT 0");
  add("products", "at_location_enabled", "at_location_enabled INTEGER NOT NULL DEFAULT 0");
  add("products", "quote_form_json", "quote_form_json TEXT NOT NULL DEFAULT ''");
  add("products", "brand", "brand TEXT NOT NULL DEFAULT ''");
  add("products", "payment_methods", "payment_methods TEXT NOT NULL DEFAULT '[]'");
  add("products", "card_payment_url", "card_payment_url TEXT NOT NULL DEFAULT ''");
  add("products", "interac_email", "interac_email TEXT NOT NULL DEFAULT ''");
  add("products", "venmo_username", "venmo_username TEXT NOT NULL DEFAULT ''");
  add("products", "zelle_mode", "zelle_mode TEXT NOT NULL DEFAULT 'phone'");
  add("products", "zelle_contact", "zelle_contact TEXT NOT NULL DEFAULT ''");
  add("products", "seller_contact_mode", "seller_contact_mode TEXT NOT NULL DEFAULT 'email'");
  add("products", "seller_contact", "seller_contact TEXT NOT NULL DEFAULT ''");
  add("products", "deactivates_at", "deactivates_at TEXT");
  add("products", "deactivated_at", "deactivated_at TEXT");
  add("users", "role", "role TEXT NOT NULL DEFAULT 'seller'");
  add("quotes", "documents_json", "documents_json TEXT NOT NULL DEFAULT '[]'");
  add("orders", "public_ref", "public_ref TEXT NOT NULL DEFAULT ''");
  add("orders", "seller_id", "seller_id TEXT NOT NULL DEFAULT ''");
  add("orders", "buyer_id", "buyer_id TEXT");
  add("orders", "subtotal", "subtotal INTEGER NOT NULL DEFAULT 0");
  add("orders", "shipping", "shipping INTEGER NOT NULL DEFAULT 0");
  add("orders", "tax", "tax INTEGER NOT NULL DEFAULT 0");
  add("orders", "total", "total INTEGER NOT NULL DEFAULT 0");
  add("orders", "payment_status", "payment_status TEXT NOT NULL DEFAULT 'unpaid'");
  add("orders", "payment_provider", "payment_provider TEXT NOT NULL DEFAULT ''");
  add("orders", "provider_payment_id", "provider_payment_id TEXT NOT NULL DEFAULT ''");
  add("orders", "paid_at", "paid_at TEXT");
  add("orders", "protection_status", "protection_status TEXT NOT NULL DEFAULT 'pending'");
  add("orders", "protection_started_at", "protection_started_at TEXT");
  add("orders", "protection_days", "protection_days INTEGER NOT NULL DEFAULT 21");
  add("orders", "payout_eligible_at", "payout_eligible_at TEXT");
  add("orders", "payout_status", "payout_status TEXT NOT NULL DEFAULT 'none'");
  add("orders", "payout_amount", "payout_amount INTEGER NOT NULL DEFAULT 0");
  add("orders", "provider_transfer_id", "provider_transfer_id TEXT NOT NULL DEFAULT ''");
  add("orders", "payout_created_at", "payout_created_at TEXT");
  add("orders", "payout_completed_at", "payout_completed_at TEXT");
  add("orders", "refund_status", "refund_status TEXT NOT NULL DEFAULT 'none'");
  add("orders", "dispute_status", "dispute_status TEXT NOT NULL DEFAULT 'none'");
  add("page_views", "user_id", "user_id TEXT");
  database.exec("CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id)");
  database.exec(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      order_id TEXT,
      seller_id TEXT NOT NULL DEFAULT '',
      buyer_id TEXT,
      account TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      owner_kind TEXT NOT NULL,
      owner_id TEXT NOT NULL DEFAULT '',
      available_at TEXT,
      memo TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_entries(order_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_seller ON ledger_entries(seller_id, account);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_once
      ON ledger_entries(order_id, account, entry_type)
      WHERE entry_type IN ('PAYMENT', 'STRIPE_FEE', 'TWIGIGI_FEE', 'SELLER_PAYABLE', 'PAYOUT', 'PAYOUT_COMPLETED');
  `);
  backfillOrders(database);
  ensureOrderNumbers(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

  `);
  migrateCommerce(database);
  database.prepare(`UPDATE users SET role = 'user' WHERE role NOT IN ('admin', 'user')`).run();
  promoteAdmins(database);
  const paid = database.prepare(`SELECT id FROM orders WHERE payment_status = 'paid' OR status IN ('paid', 'fulfilled')`).all() as Array<{ id: string }>;
  for (const row of paid) postPaymentLedger(database, row.id);
}

function backfillOrders(database: DatabaseSync) {
  database.prepare(
    `UPDATE orders SET seller_id = (
       SELECT user_id FROM products WHERE products.id = orders.product_id
     ) WHERE seller_id = ''`,
  ).run();
  database.prepare(
    `UPDATE orders SET buyer_id = (
       SELECT id FROM users WHERE lower(users.email) = lower(orders.email)
     ) WHERE buyer_id IS NULL
       AND EXISTS (SELECT 1 FROM users WHERE lower(users.email) = lower(orders.email))`,
  ).run();
  database.prepare(
    `UPDATE orders
     SET subtotal = amount_cents, total = amount_cents, payout_amount = amount_cents
     WHERE subtotal = 0 AND total = 0 AND amount_cents > 0`,
  ).run();
  const paid = database
    .prepare(
      `SELECT id, created_at, stripe_session_id FROM orders
       WHERE status IN ('paid', 'fulfilled') AND (paid_at IS NULL OR paid_at = '')`,
    )
    .all() as Array<{ id: string; created_at: string; stripe_session_id: string | null }>;
  const fill = database.prepare(
    `UPDATE orders SET
       payment_status = 'paid',
       payment_provider = CASE WHEN ? != '' THEN 'stripe' ELSE payment_provider END,
       provider_payment_id = CASE WHEN provider_payment_id = '' THEN ? ELSE provider_payment_id END,
       paid_at = ?,
       protection_status = 'active',
       protection_started_at = ?,
       protection_days = ?,
       payout_eligible_at = ?,
       payout_status = CASE WHEN payout_status = 'none' THEN 'held' ELSE payout_status END
     WHERE id = ?`,
  );
  for (const row of paid) {
    const started = row.created_at;
    const eligible = new Date(new Date(started).getTime() + PROTECTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = row.stripe_session_id ?? "";
    fill.run(sessionId, sessionId, started, started, PROTECTION_DAYS, eligible, row.id);
  }
}

function ensureOrderNumbers(database: DatabaseSync) {
  database.exec(`CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)`);
  database.prepare(`INSERT INTO counters (name, value) VALUES ('order', 10000) ON CONFLICT(name) DO NOTHING`).run();
  const missing = database.prepare(`SELECT id FROM orders WHERE public_ref = '' ORDER BY created_at ASC`).all() as Array<{ id: string }>;
  const assign = database.prepare(`UPDATE orders SET public_ref = ? WHERE id = ?`);
  for (const row of missing) assign.run(nextOrderRef(database), row.id);
}

function nextOrderRef(database: DatabaseSync) {
  const row = database.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'order' RETURNING value`).get() as { value: number } | undefined;
  return `TW-${row?.value ?? 10001}`;
}

function nextCounter(database: DatabaseSync, name: string, prefix: string) {
  database.exec(`CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)`);
  database.prepare(`INSERT INTO counters (name, value) VALUES (?, 10000) ON CONFLICT(name) DO NOTHING`).run(name);
  const row = database.prepare(`UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value`).get(name) as { value: number } | undefined;
  return `${prefix}${row?.value ?? 10001}`;
}

function freshId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `${prefix}_${Buffer.from(bytes).toString("base64url")}`;
}

function migrateCommerce(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      public_ref TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT,
      buyer_email TEXT NOT NULL,
      buyer_confirmed_at TEXT,
      seller_confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(
    `INSERT INTO interactions (
      id, public_ref, kind, source_id, product_id, seller_id, buyer_id, buyer_email, buyer_confirmed_at, seller_confirmed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
  );
  const orders = database.prepare(
    `SELECT id, product_id, seller_id, buyer_id, email, created_at FROM orders
     WHERE seller_id != '' AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.source_id = orders.id)`,
  ).all() as Row[];
  for (const row of orders) {
    insert.run(freshId("int"), nextCounter(database, "interaction", "IX-"), "order", str(row.id), str(row.product_id), str(row.seller_id), row.buyer_id ? str(row.buyer_id) : null, str(row.email).toLowerCase(), str(row.created_at));
  }
  const quotes = database.prepare(
    `SELECT q.id, q.product_id, p.user_id AS seller_id, q.email, q.created_at,
       (SELECT u.id FROM users u WHERE lower(u.email) = lower(q.email)) AS buyer_id
     FROM quotes q JOIN products p ON p.id = q.product_id
     WHERE NOT EXISTS (SELECT 1 FROM interactions i WHERE i.source_id = q.id)`,
  ).all() as Row[];
  for (const row of quotes) {
    insert.run(freshId("int"), nextCounter(database, "interaction", "IX-"), "quote", str(row.id), str(row.product_id), str(row.seller_id), row.buyer_id ? str(row.buyer_id) : null, str(row.email).toLowerCase(), str(row.created_at));
  }
  const existing = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reviews'`).get() as { name: string } | undefined;
  const columns = existing ? (database.prepare(`PRAGMA table_info(reviews)`).all() as Array<{ name: string }>) : [];
  if (columns.some((column) => column.name === "interaction_id")) return;
  database.exec(`
    CREATE TABLE reviews_next (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      interaction_id TEXT NOT NULL UNIQUE,
      overall INTEGER NOT NULL,
      as_described INTEGER NOT NULL,
      communication INTEGER NOT NULL,
      reliability INTEGER NOT NULL,
      quality INTEGER,
      body TEXT NOT NULL DEFAULT '',
      images_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);
  if (existing) {
    const old = database.prepare(`SELECT * FROM reviews`).all() as Row[];
    const copy = database.prepare(
      `INSERT INTO reviews_next (
        id, user_id, seller_id, product_id, interaction_id, overall, as_described, communication, reliability, quality, body, images_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, '[]', ?)`,
    );
    for (const row of old) {
      const interaction = database.prepare(`SELECT id, seller_id FROM interactions WHERE source_id = ?`).get(str(row.order_id)) as Row | undefined;
      if (!interaction) continue;
      const score = num(row.rating);
      copy.run(str(row.id), str(row.user_id), str(interaction.seller_id), str(row.product_id), str(interaction.id), score, score, score, score, str(row.body), str(row.created_at));
    }
    database.exec(`DROP TABLE reviews`);
  }
  database.exec(`ALTER TABLE reviews_next RENAME TO reviews`);
}

function promoteAdmins(database: DatabaseSync) {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.includes("ava@twigigi.demo")) emails.push("ava@twigigi.demo");
  if (!emails.includes("chenk@dybridge.com")) emails.push("chenk@dybridge.com");
  const update = database.prepare(`UPDATE users SET role = 'admin' WHERE email = ?`);
  for (const email of emails) update.run(email);
}

function ledgerId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `led_${Buffer.from(bytes).toString("base64url")}`;
}

function appendLedger(database: DatabaseSync, input: { orderId: string; sellerId: string; buyerId: string | null; currency: string; lines: LedgerDraft[] }) {
  if (journalBalances(input.lines) !== 0) throw new Error("Unbalanced ledger");
  const insert = database.prepare(
    `INSERT INTO ledger_entries (
      id, created_at, order_id, seller_id, buyer_id, account, entry_type, amount_cents, currency, owner_kind, owner_id, available_at, memo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  for (const line of input.lines) {
    insert.run(
      ledgerId(),
      now,
      input.orderId,
      input.sellerId,
      input.buyerId,
      line.account,
      line.entryType,
      line.amountCents,
      input.currency,
      line.ownerKind,
      line.ownerKind === "seller" ? input.sellerId : line.ownerKind === "buyer" ? input.buyerId ?? "" : "",
      line.availableAt,
      line.memo,
    );
  }
}

function postPaymentLedger(database: DatabaseSync, orderId: string) {
  const existing = database.prepare(`SELECT id FROM ledger_entries WHERE order_id = ? AND account = 'processor' AND entry_type = 'PAYMENT' LIMIT 1`).get();
  if (existing) return;
  const order = database.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as Row | undefined;
  if (!order) return;
  const paid = num(order.total) || num(order.amount_cents);
  if (paid <= 0) return;
  const split = splitPayment(paid);
  const lines = paymentJournal(split, order.payout_eligible_at ? str(order.payout_eligible_at) : null);
  try {
    database.exec("BEGIN");
    appendLedger(database, {
      orderId,
      sellerId: str(order.seller_id),
      buyerId: order.buyer_id ? str(order.buyer_id) : null,
      currency: str(order.currency || "CAD"),
      lines,
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("UNIQUE")) throw error;
  }
}

const db = globalForDb.twigigiDb ?? openDatabase();
globalForDb.twigigiDb = db;
ensureColumns(db);

function str(value: unknown) {
  return String(value ?? "");
}

function num(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown) {
  if (value == null || value === "") return null;
  return num(value);
}

function one(sql: string, ...params: Array<string | number | null>) {
  return db.prepare(sql).get(...params) as Row | undefined;
}

function many(sql: string, ...params: Array<string | number | null>) {
  return db.prepare(sql).all(...params) as Row[];
}

function parseStoredMethods(raw: string) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function mapProduct(row: Row): Product {
  let images: string[] = [];
  try {
    const parsed = JSON.parse(str(row.images_json));
    if (Array.isArray(parsed)) images = parsed.filter((item) => typeof item === "string");
  } catch {
    images = [];
  }
  const cta: Cta = row.cta === "buy" || row.cta === "contact" ? row.cta : "quote";
  const options = readStoredOptions(str(row.options_json));
  const priceCents = nullableNum(row.price_cents);
  return {
    id: str(row.id),
    userId: str(row.user_id),
    slug: str(row.slug),
    title: str(row.title),
    brand: str(row.brand),
    description: str(row.description),
    priceCents,
    currency: str(row.currency || "CAD"),
    location: str(row.location),
    videoUrl: row.video_url ? str(row.video_url) : null,
    pickupEnabled: num(row.pickup_enabled) === 1,
    pickupNote: str(row.pickup_note),
    pickupTime: str(row.pickup_time),
    deliveryEnabled: num(row.delivery_enabled) === 1,
    deliveryRadiusKm: nullableNum(row.delivery_radius_km),
    deliveryFeeCents: nullableNum(row.delivery_fee_cents),
    shippingEnabled: num(row.shipping_enabled) === 1,
    shippingFeeCents: nullableNum(row.shipping_fee_cents),
    shippingNote: str(row.shipping_note),
    onsiteEnabled: num(row.onsite_enabled) === 1,
    remoteEnabled: num(row.remote_enabled) === 1,
    atLocationEnabled: num(row.at_location_enabled) === 1,
    cta,
    contactEmail: str(row.contact_email),
    contactPhone: str(row.contact_phone),
    status: row.status === "published" ? "published" : row.status === "deactivated" ? "deactivated" : "draft",
    images,
    quantityAvailable: row.quantity_available == null || row.quantity_available === "" ? null : num(row.quantity_available),
    buttonLabel: str(row.button_label) || "Buy now",
    hasOptions: num(row.has_options) === 1,
    samePrice: row.same_price == null ? true : num(row.same_price) === 1,
    options,
    variants: readStoredVariants(str(row.variants_json), options, priceCents ?? 0),
    requireName: row.require_name == null ? true : num(row.require_name) === 1,
    requireEmail: true,
    requirePhone: row.require_phone == null ? true : num(row.require_phone) === 1,
    quoteForm: parseQuoteForm(str(row.quote_form_json)),
    paymentMethods: parseStoredMethods(str(row.payment_methods)),
    cardPaymentUrl: str(row.card_payment_url),
    interacEmail: str(row.interac_email),
    venmoUsername: str(row.venmo_username),
    zelleMode: row.zelle_mode === "email" ? "email" : "phone",
    zelleContact: str(row.zelle_contact),
    sellerContactMode: row.seller_contact_mode === "phone" ? "phone" : "email",
    sellerContact: str(row.seller_contact),
    viewCount: num(row.view_count),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deactivatesAt: row.deactivates_at ? str(row.deactivates_at) : null,
    deactivatedAt: row.deactivated_at ? str(row.deactivated_at) : null,
  };
}

export function settleDeactivations(now = new Date().toISOString()) {
  db.prepare(
    `UPDATE products
     SET status = 'deactivated',
         deactivated_at = CASE WHEN deactivated_at IS NULL OR deactivated_at = '' THEN deactivates_at ELSE deactivated_at END,
         updated_at = ?
     WHERE status = 'published'
       AND deactivates_at IS NOT NULL
       AND deactivates_at != ''
       AND deactivates_at <= ?`,
  ).run(now, now);
  db.prepare(
    `UPDATE products
     SET deactivated_at = updated_at
     WHERE status = 'deactivated' AND (deactivated_at IS NULL OR deactivated_at = '')`,
  ).run();
  const expired = many(
    `SELECT id, deactivated_at FROM products
     WHERE status = 'deactivated' AND deactivated_at IS NOT NULL AND deactivated_at != ''`,
  );
  const nowTime = Date.parse(now);
  for (const row of expired) {
    const due = Date.parse(addDays(str(row.deactivated_at), DEACTIVATION_GRACE_DAYS));
    if (Number.isFinite(due) && due <= nowTime) eraseProduct(str(row.id));
  }
}

function eraseProduct(id: string) {
  db.prepare("DELETE FROM favorites WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM reviews WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM page_views WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM quotes WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM messages WHERE product_id = ?").run(id);
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

function mapPublic(row: Row): PublicProduct {
  return { ...mapProduct(row), username: str(row.username), displayName: str(row.display_name) };
}

function mapUser(row: Row): User {
  const role: UserRole = row.role === "admin" ? "admin" : "user";
  return {
    id: str(row.id),
    email: str(row.email),
    username: str(row.username),
    displayName: str(row.display_name),
    role,
    createdAt: str(row.created_at),
  };
}

const ORDER_SELECT = `
  SELECT o.*,
    COALESCE(p.title, 'Removed Twig') AS product_title,
    COALESCE(p.slug, '') AS product_slug,
    u.username,
    u.display_name
  FROM orders o
  JOIN users u ON u.id = o.seller_id
  LEFT JOIN products p ON p.id = o.product_id
`;

function mapOrder(row: Row): OrderRecord {
  const fulfillment: Fulfillment =
    row.fulfillment === "delivery" || row.fulfillment === "shipping" ? row.fulfillment : "pickup";
  const status: OrderStatus =
    row.status === "paid" || row.status === "fulfilled" || row.status === "canceled" ? row.status : "unpaid";
  const paymentStatus: PaymentStatus = row.payment_status === "paid" ? "paid" : "unpaid";
  const protectionStatus: ProtectionStatus = row.protection_status === "active" ? "active" : "pending";
  const payoutStatus: PayoutStatus =
    row.payout_status === "held" || row.payout_status === "processing" || row.payout_status === "paid" ? row.payout_status : "none";
  return {
    id: str(row.id),
    publicRef: str(row.public_ref),
    productId: str(row.product_id),
    sellerId: str(row.seller_id),
    buyerId: row.buyer_id ? str(row.buyer_id) : null,
    productSlug: str(row.product_slug),
    productTitle: str(row.product_title),
    username: str(row.username),
    displayName: str(row.display_name),
    buyerName: str(row.buyer_name),
    email: str(row.email),
    phone: str(row.phone),
    quantity: num(row.quantity),
    fulfillment,
    address: str(row.address),
    amountCents: num(row.amount_cents),
    subtotalCents: num(row.subtotal),
    shippingCents: num(row.shipping),
    taxCents: num(row.tax),
    totalCents: num(row.total),
    currency: str(row.currency),
    variantLabel: str(row.variant_label),
    status,
    paymentStatus,
    paymentProvider: str(row.payment_provider),
    providerPaymentId: str(row.provider_payment_id),
    paidAt: row.paid_at ? str(row.paid_at) : null,
    protectionStatus,
    protectionStartedAt: row.protection_started_at ? str(row.protection_started_at) : null,
    protectionDays: num(row.protection_days) || PROTECTION_DAYS,
    payoutEligibleAt: row.payout_eligible_at ? str(row.payout_eligible_at) : null,
    payoutStatus,
    payoutAmountCents: num(row.payout_amount),
    providerTransferId: str(row.provider_transfer_id),
    payoutCreatedAt: row.payout_created_at ? str(row.payout_created_at) : null,
    payoutCompletedAt: row.payout_completed_at ? str(row.payout_completed_at) : null,
    refundStatus: str(row.refund_status) || "none",
    disputeStatus: str(row.dispute_status) || "none",
    stripeSessionId: row.stripe_session_id ? str(row.stripe_session_id) : null,
    src: str(row.src),
    createdAt: str(row.created_at),
  };
}

function mapQuote(row: Row): QuoteRecord {
  const status = row.status === "contacted" || row.status === "closed" ? row.status : "new";
  return {
    id: str(row.id),
    productId: str(row.product_id),
    productSlug: str(row.product_slug),
    productTitle: str(row.product_title),
    username: str(row.username),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    message: str(row.message),
    quantity: num(row.quantity),
    projectDetails: str(row.project_details),
    documents: parseQuoteDocuments(str(row.documents_json)),
    status,
    src: str(row.src),
    createdAt: str(row.created_at),
  };
}

function parseQuoteDocuments(raw: string) {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  const documents: { path: string; name: string }[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const filePath = typeof record.path === "string" ? record.path : "";
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
    if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(filePath)) continue;
    documents.push({ path: filePath, name: name || "file" });
    if (documents.length === 4) break;
  }
  return documents;
}

function mapMessage(row: Row): MessageRecord {
  const status = row.status === "read" || row.status === "closed" ? row.status : "new";
  return {
    id: str(row.id),
    productId: str(row.product_id),
    productSlug: str(row.product_slug),
    productTitle: str(row.product_title),
    username: str(row.username),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    message: str(row.message),
    status,
    src: str(row.src),
    createdAt: str(row.created_at),
  };
}

export function findUserById(id: string) {
  const row = one("SELECT * FROM users WHERE id = ?", id);
  return row ? mapUser(row) : null;
}

export function findUserByEmail(email: string) {
  const row = one("SELECT * FROM users WHERE email = ?", email.toLowerCase());
  if (!row) return null;
  return { ...mapUser(row), passwordHash: str(row.password_hash) };
}

export function findUserByUsername(username: string) {
  const row = one("SELECT id FROM users WHERE lower(username) = ?", username.toLowerCase());
  return row ? str(row.id) : null;
}

export function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
}) {
  db.prepare(
    "INSERT INTO users (id, email, password_hash, username, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, 'user', ?)",
  ).run(input.id, input.email.toLowerCase(), input.passwordHash, input.username, input.displayName, new Date().toISOString());
}

export function updateUsername(id: string, username: string) {
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, id);
}

export function userHasTwigs(userId: string) {
  return Boolean(one("SELECT 1 AS n FROM products WHERE user_id = ? LIMIT 1", userId));
}

export function listUsers() {
  return many(
    `SELECT u.*,
      (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id) AS product_count,
      (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS order_count
     FROM users u
     ORDER BY u.created_at ASC`,
  ).map((row) => ({ ...mapUser(row), productCount: num(row.product_count), orderCount: num(row.order_count) }));
}

export function updateUserRole(id: string, role: UserRole) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function updatePassword(userId: string, passwordHash: string) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function replacePasswordReset(id: string, userId: string, tokenHash: string, expiresAt: string) {
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
  db.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(id, userId, tokenHash, expiresAt);
}

export function takePasswordReset(tokenHash: string) {
  const row = one("SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?", tokenHash);
  if (!row || row.used_at) return null;
  if (Date.parse(str(row.expires_at)) <= Date.now()) return null;
  db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(new Date().toISOString(), str(row.id));
  return str(row.user_id);
}

export function claimBuyerOrders(userId: string, email: string) {
  db.prepare("UPDATE orders SET buyer_id = ? WHERE buyer_id IS NULL AND lower(email) = ?").run(userId, email.toLowerCase());
}

export function getProductById(id: string) {
  settleDeactivations();
  const row = one("SELECT * FROM products WHERE id = ?", id);
  return row ? mapProduct(row) : null;
}

export function getPublishedProduct(username: string, slug: string) {
  const row = one(
    `SELECT p.*, u.username, u.display_name
     FROM products p JOIN users u ON u.id = p.user_id
     WHERE u.username = ? AND p.slug = ? AND p.status = 'published'`,
    username,
    slug,
  );
  return row ? mapPublic(row) : null;
}

export function getSellerWithProducts(username: string): PublicSeller | null {
  const user = one("SELECT id, username, display_name, role FROM users WHERE username = ?", username);
  if (!user || /^[ub][0-9a-f]{12}$/.test(str(user.username))) return null;
  const products = many(
    `SELECT p.*, u.username, u.display_name
     FROM products p JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ? AND p.status = 'published'
     ORDER BY p.updated_at DESC`,
    str(user.id),
  ).map(mapPublic);
  const rating = sellerReviewSummary(str(user.id));
  return { username: str(user.username), displayName: str(user.display_name), products, ratingAverage: rating.average, ratingCount: rating.count };
}

export function listPublishedParams() {
  return many(
    `SELECT u.username AS username, p.slug AS product, p.cta AS cta
     FROM products p JOIN users u ON u.id = p.user_id
     WHERE p.status = 'published'`,
  ).map((row) => ({
    username: str(row.username),
    product: str(row.product),
    cta: (row.cta === "buy" || row.cta === "contact" ? row.cta : "quote") as Cta,
  }));
}

export function slugTaken(userId: string, slug: string, exceptId?: string) {
  const row = exceptId
    ? one("SELECT id FROM products WHERE user_id = ? AND slug = ? AND id != ?", userId, slug, exceptId)
    : one("SELECT id FROM products WHERE user_id = ? AND slug = ?", userId, slug);
  return Boolean(row);
}

export function uniqueSlug(userId: string, base: string, exceptId?: string) {
  const root = base || "item";
  let slug = root;
  let n = 2;
  while (slugTaken(userId, slug, exceptId)) {
    slug = `${root}-${n}`;
    n += 1;
  }
  return slug;
}

export function insertProduct(id: string, userId: string, input: ProductInput) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO products (
      id, user_id, slug, title, brand, description, price_cents, currency, location, video_url,
      pickup_enabled, pickup_note, pickup_time, delivery_enabled, delivery_radius_km, delivery_fee_cents,
      shipping_enabled, shipping_fee_cents, shipping_note, onsite_enabled, remote_enabled, at_location_enabled,
      quote_form_json, cta, contact_email, contact_phone,
      status, images_json, view_count, created_at, updated_at,
      quantity_available, button_label, has_options, same_price, options_json, variants_json,
      require_name, require_email, require_phone, payment_methods, card_payment_url, interac_email,
      venmo_username, zelle_mode, zelle_contact, seller_contact_mode, seller_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CAD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.slug,
    input.title,
    input.brand,
    input.description,
    input.priceCents,
    input.location,
    input.videoUrl,
    input.pickupEnabled ? 1 : 0,
    input.pickupNote,
    input.pickupTime,
    input.deliveryEnabled ? 1 : 0,
    input.deliveryRadiusKm,
    input.deliveryFeeCents,
    input.shippingEnabled ? 1 : 0,
    input.shippingFeeCents,
    input.shippingNote,
    input.onsiteEnabled ? 1 : 0,
    input.remoteEnabled ? 1 : 0,
    input.atLocationEnabled ? 1 : 0,
    input.quoteForm ? JSON.stringify(input.quoteForm) : "",
    input.cta,
    input.contactEmail,
    input.contactPhone,
    input.status,
    JSON.stringify(input.images),
    now,
    now,
    input.quantityAvailable,
    input.buttonLabel || "Buy now",
    input.hasOptions ? 1 : 0,
    input.samePrice ? 1 : 0,
    JSON.stringify(input.options),
    JSON.stringify(input.variants),
    input.requireName ? 1 : 0,
    1,
    input.requirePhone ? 1 : 0,
    JSON.stringify(input.paymentMethods),
    input.cardPaymentUrl,
    input.interacEmail,
    input.venmoUsername,
    input.zelleMode,
    input.zelleContact,
    input.sellerContactMode,
    input.sellerContact,
  );
}

export function updateProduct(id: string, userId: string, input: ProductInput) {
  const result = db
    .prepare(
      `UPDATE products SET
        slug = ?, title = ?, brand = ?, description = ?, price_cents = ?, location = ?, video_url = ?,
        pickup_enabled = ?, pickup_note = ?, pickup_time = ?, delivery_enabled = ?, delivery_radius_km = ?, delivery_fee_cents = ?,
        shipping_enabled = ?, shipping_fee_cents = ?, shipping_note = ?,
        onsite_enabled = ?, remote_enabled = ?, at_location_enabled = ?, quote_form_json = ?,
        cta = ?, contact_email = ?, contact_phone = ?,
        status = ?, images_json = ?, updated_at = ?,
        quantity_available = ?, button_label = ?, has_options = ?, same_price = ?,
        options_json = ?, variants_json = ?, require_name = ?, require_email = ?, require_phone = ?,
        payment_methods = ?, card_payment_url = ?, interac_email = ?,
        venmo_username = ?, zelle_mode = ?, zelle_contact = ?, seller_contact_mode = ?, seller_contact = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      input.slug,
      input.title,
      input.brand,
      input.description,
      input.priceCents,
      input.location,
      input.videoUrl,
      input.pickupEnabled ? 1 : 0,
      input.pickupNote,
      input.pickupTime,
      input.deliveryEnabled ? 1 : 0,
      input.deliveryRadiusKm,
      input.deliveryFeeCents,
      input.shippingEnabled ? 1 : 0,
      input.shippingFeeCents,
      input.shippingNote,
      input.onsiteEnabled ? 1 : 0,
      input.remoteEnabled ? 1 : 0,
      input.atLocationEnabled ? 1 : 0,
      input.quoteForm ? JSON.stringify(input.quoteForm) : "",
      input.cta,
      input.contactEmail,
      input.contactPhone,
      input.status,
      JSON.stringify(input.images),
      new Date().toISOString(),
      input.quantityAvailable,
      input.buttonLabel || "Buy now",
      input.hasOptions ? 1 : 0,
      input.samePrice ? 1 : 0,
      JSON.stringify(input.options),
      JSON.stringify(input.variants),
      input.requireName ? 1 : 0,
      1,
      input.requirePhone ? 1 : 0,
      JSON.stringify(input.paymentMethods),
      input.cardPaymentUrl,
      input.interacEmail,
      input.venmoUsername,
      input.zelleMode,
      input.zelleContact,
      input.sellerContactMode,
      input.sellerContact,
      id,
      userId,
    );
  return result.changes > 0;
}

export function setDeactivatesAt(id: string, userId: string, at: string | null) {
  const result = db
    .prepare(
      `UPDATE products SET deactivates_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND status = 'published'`,
    )
    .run(at, new Date().toISOString(), id, userId);
  return result.changes > 0;
}

export function clearDeactivatesAt(id: string, userId: string) {
  db.prepare("UPDATE products SET deactivates_at = NULL WHERE id = ? AND user_id = ?").run(id, userId);
}

export function clearDeactivatedAt(id: string, userId: string) {
  db.prepare("UPDATE products SET deactivated_at = NULL WHERE id = ? AND user_id = ?").run(id, userId);
}

export function reactivateProduct(id: string, userId: string) {
  db.prepare(
    `UPDATE products
     SET status = 'published', deactivates_at = NULL, deactivated_at = NULL, updated_at = ?
     WHERE id = ? AND user_id = ? AND status = 'deactivated'`,
  ).run(new Date().toISOString(), id, userId);
}

export function productHasActivity(productId: string) {
  const row = one(
    `SELECT
      (SELECT COUNT(*) FROM orders WHERE product_id = ?) +
      (SELECT COUNT(*) FROM quotes WHERE product_id = ?) +
      (SELECT COUNT(*) FROM messages WHERE product_id = ?) AS n`,
    productId,
    productId,
    productId,
  );
  return num(row?.n) > 0;
}

export function deleteProduct(id: string, userId: string) {
  db.prepare("DELETE FROM page_views WHERE product_id = ?").run(id);
  const result = db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(id, userId);
  return result.changes > 0;
}

export function sellerProducts(userId: string) {
  settleDeactivations();
  return many("SELECT * FROM products WHERE user_id = ? ORDER BY updated_at DESC", userId).map(mapProduct);
}

export function recordView(productId: string, src: string, userId: string | null) {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO page_views (product_id, src, created_at, user_id) VALUES (?, ?, ?, ?)").run(productId, src, now, userId);
  db.prepare("UPDATE products SET view_count = view_count + 1 WHERE id = ?").run(productId);
}

export function sellerStats(userId: string): SellerStats {
  const views = one(
    "SELECT COUNT(*) AS n FROM page_views v JOIN products p ON p.id = v.product_id WHERE p.user_id = ?",
    userId,
  );
  const orders = one(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN o.status IN ('paid', 'fulfilled') THEN o.amount_cents ELSE 0 END), 0) AS revenue
     FROM orders o WHERE o.seller_id = ?`,
    userId,
  );
  const quotes = one(
    "SELECT COUNT(*) AS n FROM quotes q JOIN products p ON p.id = q.product_id WHERE p.user_id = ?",
    userId,
  );
  const messages = one(
    "SELECT COUNT(*) AS n FROM messages m JOIN products p ON p.id = m.product_id WHERE p.user_id = ?",
    userId,
  );
  const sources = many(
    `SELECT v.src AS src, COUNT(*) AS n
     FROM page_views v JOIN products p ON p.id = v.product_id
     WHERE p.user_id = ?
     GROUP BY v.src
     ORDER BY n DESC`,
    userId,
  );
  return {
    views: num(views?.n),
    orders: num(orders?.n),
    revenueCents: num(orders?.revenue),
    quotes: num(quotes?.n),
    messages: num(messages?.n),
    sources: sources.map((row) => ({ src: str(row.src), count: num(row.n) })),
  };
}

export function sellerViewSources(userId: string) {
  const rows = many(
    `SELECT v.product_id AS product_id, v.src AS src, COUNT(*) AS n
     FROM page_views v JOIN products p ON p.id = v.product_id
     WHERE p.user_id = ?
     GROUP BY v.product_id, v.src
     ORDER BY n DESC`,
    userId,
  );
  const byProduct = new Map<string, { src: string; count: number }[]>();
  for (const row of rows) {
    const id = str(row.product_id);
    const list = byProduct.get(id) ?? [];
    list.push({ src: str(row.src), count: num(row.n) });
    byProduct.set(id, list);
  }
  return byProduct;
}

export function insertOrder(input: {
  id: string;
  productId: string;
  sellerId: string;
  buyerId: string | null;
  buyerName: string;
  email: string;
  phone: string;
  quantity: number;
  fulfillment: Fulfillment;
  address: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  src: string;
  variantLabel: string;
}) {
  db.prepare(
    `INSERT INTO orders (
      id, public_ref, product_id, seller_id, buyer_id, buyer_name, email, phone, quantity, fulfillment, address,
      amount_cents, subtotal, shipping, tax, total, currency, status,
      payment_status, payment_provider, provider_payment_id,
      protection_status, protection_days, payout_status, payout_amount,
      refund_status, dispute_status,
      stripe_session_id, src, variant_label, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, 'unpaid',
      'unpaid', '', '',
      'pending', ?, 'none', ?,
      'none', 'none',
      NULL, ?, ?, ?
    )`,
  ).run(
    input.id,
    nextOrderRef(db),
    input.productId,
    input.sellerId,
    input.buyerId,
    input.buyerName,
    input.email,
    input.phone,
    input.quantity,
    input.fulfillment,
    input.address,
    input.totalCents,
    input.subtotalCents,
    input.shippingCents,
    input.taxCents,
    input.totalCents,
    input.currency,
    0,
    input.totalCents,
    input.src,
    input.variantLabel,
    new Date().toISOString(),
  );
}

export function reserveStock(productId: string, quantity: number) {
  const row = one("SELECT quantity_available AS n FROM products WHERE id = ?", productId);
  if (!row) return false;
  if (row.n == null) return true;
  const result = db
    .prepare(
      `UPDATE products SET quantity_available = quantity_available - ?
       WHERE id = ? AND quantity_available >= ?`,
    )
    .run(quantity, productId, quantity);
  return result.changes > 0;
}

export function releaseStock(productId: string, quantity: number) {
  db.prepare(
    `UPDATE products SET quantity_available = quantity_available + ?
     WHERE id = ? AND quantity_available IS NOT NULL`,
  ).run(quantity, productId);
}

export function attachStripeSession(orderId: string, sessionId: string) {
  db.prepare(
    `UPDATE orders SET
       stripe_session_id = ?,
       payment_provider = 'stripe',
       provider_payment_id = CASE WHEN provider_payment_id = '' THEN ? ELSE provider_payment_id END
     WHERE id = ?`,
  ).run(sessionId, sessionId, orderId);
}

export function markOrderPaid(orderId: string, sessionId: string, providerPaymentId = "") {
  const paymentId = providerPaymentId || sessionId;
  db.prepare(
    `UPDATE orders SET
       status = 'paid',
       stripe_session_id = ?,
       payment_provider = 'stripe',
       provider_payment_id = ?
     WHERE id = ? AND status = 'unpaid'`,
  ).run(sessionId, paymentId, orderId);
  beginPaymentProtection(orderId);
}

function beginPaymentProtection(orderId: string) {
  const paidAt = new Date();
  const eligible = paidAt.toISOString();
  db.prepare(
    `UPDATE orders SET
       payment_status = 'paid',
       paid_at = ?,
       protection_status = 'active',
       protection_started_at = ?,
       protection_days = ?,
       payout_eligible_at = ?,
       payout_status = CASE WHEN payout_status = 'none' THEN 'held' ELSE payout_status END
     WHERE id = ? AND (paid_at IS NULL OR paid_at = '')`,
  ).run(paidAt.toISOString(), paidAt.toISOString(), 0, eligible, orderId);
  postPaymentLedger(db, orderId);
}

export function getOrder(id: string) {
  const row = one(`${ORDER_SELECT} WHERE o.id = ?`, id);
  return row ? mapOrder(row) : null;
}

export function listOrders(userId: string) {
  return many(`${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 100`, userId).map(mapOrder);
}

export function listBuyerOrders(userId: string) {
  return many(`${ORDER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 50`, userId).map(mapOrder);
}

export function isFavorite(userId: string, productId: string) {
  return Boolean(one("SELECT 1 AS n FROM favorites WHERE user_id = ? AND product_id = ?", userId, productId));
}

export function toggleFavorite(userId: string, productId: string) {
  if (isFavorite(userId, productId)) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND product_id = ?").run(userId, productId);
    return false;
  }
  db.prepare("INSERT INTO favorites (user_id, product_id, created_at) VALUES (?, ?, ?)").run(userId, productId, new Date().toISOString());
  return true;
}

export function listFavorites(userId: string) {
  return many(
    `SELECT p.*, u.username, u.display_name
     FROM favorites f
     JOIN products p ON p.id = f.product_id
     JOIN users u ON u.id = p.user_id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC`,
    userId,
  ).map(mapPublic);
}

export type InteractionKind = "order" | "quote";

export type InteractionRecord = {
  id: string;
  publicRef: string;
  kind: InteractionKind;
  sourceId: string;
  productId: string;
  sellerId: string;
  buyerId: string | null;
  buyerEmail: string;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  createdAt: string;
  productTitle: string;
  username: string;
  sellerName: string;
};

export type ReviewRecord = {
  id: string;
  userId: string;
  sellerId: string;
  productId: string;
  interactionId: string;
  overall: number;
  asDescribed: number;
  communication: number;
  reliability: number;
  quality: number | null;
  body: string;
  images: string[];
  createdAt: string;
  displayName: string;
  productTitle: string;
  publicRef: string;
  kind: InteractionKind;
};

function mapInteraction(row: Row): InteractionRecord {
  const kind: InteractionKind = row.kind === "quote" ? "quote" : "order";
  return {
    id: str(row.id),
    publicRef: str(row.public_ref),
    kind,
    sourceId: str(row.source_id),
    productId: str(row.product_id),
    sellerId: str(row.seller_id),
    buyerId: row.buyer_id ? str(row.buyer_id) : null,
    buyerEmail: str(row.buyer_email),
    buyerConfirmedAt: row.buyer_confirmed_at ? str(row.buyer_confirmed_at) : null,
    sellerConfirmedAt: row.seller_confirmed_at ? str(row.seller_confirmed_at) : null,
    createdAt: str(row.created_at),
    productTitle: str(row.product_title),
    username: str(row.username),
    sellerName: str(row.seller_name),
  };
}

const INTERACTION_SELECT = `
  SELECT i.*,
    COALESCE(p.title, 'Removed Twig') AS product_title,
    COALESCE(u.username, '') AS username,
    COALESCE(u.display_name, '') AS seller_name
  FROM interactions i
  LEFT JOIN products p ON p.id = i.product_id
  LEFT JOIN users u ON u.id = i.seller_id
`;

export function openInteraction(input: {
  kind: InteractionKind;
  sourceId: string;
  productId: string;
  sellerId: string;
  buyerId: string | null;
  buyerEmail: string;
  createdAt?: string;
}) {
  const existing = one("SELECT id, public_ref FROM interactions WHERE source_id = ?", input.sourceId);
  if (existing) return { id: str(existing.id), publicRef: str(existing.public_ref) };
  const id = freshId("int");
  const publicRef = nextCounter(db, "interaction", "IX-");
  db.prepare(
    `INSERT INTO interactions (
      id, public_ref, kind, source_id, product_id, seller_id, buyer_id, buyer_email, buyer_confirmed_at, seller_confirmed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
  ).run(id, publicRef, input.kind, input.sourceId, input.productId, input.sellerId, input.buyerId, input.buyerEmail.toLowerCase(), input.createdAt ?? new Date().toISOString());
  return { id, publicRef };
}

export function getInteraction(id: string) {
  const row = one(`${INTERACTION_SELECT} WHERE i.id = ?`, id);
  return row ? mapInteraction(row) : null;
}

export function getInteractionBySource(sourceId: string) {
  const row = one(`${INTERACTION_SELECT} WHERE i.source_id = ?`, sourceId);
  return row ? mapInteraction(row) : null;
}

export function listSellerInteractions(sellerId: string) {
  return many(`${INTERACTION_SELECT} WHERE i.seller_id = ? ORDER BY i.created_at DESC LIMIT 20`, sellerId).map(mapInteraction);
}

export function listBuyerInteractions(userId: string, email: string) {
  return many(
    `${INTERACTION_SELECT} WHERE i.buyer_id = ? OR lower(i.buyer_email) = ? ORDER BY i.created_at DESC LIMIT 50`,
    userId,
    email.toLowerCase(),
  ).map(mapInteraction);
}

export function listAllInteractions() {
  return many(`${INTERACTION_SELECT} ORDER BY i.created_at DESC LIMIT 100`).map(mapInteraction);
}

export function confirmInteractionParty(id: string, userId: string, email: string, side: "buyer" | "seller") {
  const row = one("SELECT * FROM interactions WHERE id = ?", id);
  if (!row) return false;
  const now = new Date().toISOString();
  if (side === "seller") {
    if (str(row.seller_id) !== userId) return false;
    db.prepare("UPDATE interactions SET seller_confirmed_at = COALESCE(seller_confirmed_at, ?) WHERE id = ?").run(now, id);
    return true;
  }
  const owns = (row.buyer_id && str(row.buyer_id) === userId) || str(row.buyer_email) === email.toLowerCase();
  if (!owns) return false;
  db.prepare("UPDATE interactions SET buyer_id = ?, buyer_confirmed_at = COALESCE(buyer_confirmed_at, ?) WHERE id = ?").run(userId, now, id);
  return true;
}

export function adminSetConfirmation(id: string, side: "buyer" | "seller", on: boolean) {
  const column = side === "buyer" ? "buyer_confirmed_at" : "seller_confirmed_at";
  const result = db.prepare(`UPDATE interactions SET ${column} = ? WHERE id = ?`).run(on ? new Date().toISOString() : null, id);
  return result.changes > 0;
}

export function sellerReviewSummary(sellerId: string) {
  const row = one("SELECT AVG(overall) AS average, COUNT(*) AS n FROM reviews WHERE seller_id = ?", sellerId);
  const count = num(row?.n);
  return { average: count > 0 ? num(row?.average) : null, count };
}

function readImages(value: unknown) {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapReview(row: Row): ReviewRecord {
  const kind: InteractionKind = row.kind === "quote" ? "quote" : "order";
  return {
    id: str(row.id),
    userId: str(row.user_id),
    sellerId: str(row.seller_id),
    productId: str(row.product_id),
    interactionId: str(row.interaction_id),
    overall: num(row.overall),
    asDescribed: num(row.as_described),
    communication: num(row.communication),
    reliability: num(row.reliability),
    quality: row.quality == null || row.quality === "" ? null : num(row.quality),
    body: str(row.body),
    images: readImages(row.images_json),
    createdAt: str(row.created_at),
    displayName: str(row.display_name),
    productTitle: str(row.product_title),
    publicRef: str(row.public_ref),
    kind,
  };
}

const REVIEW_SELECT = `
  SELECT r.*, u.display_name, COALESCE(p.title, '') AS product_title, COALESCE(i.public_ref, '') AS public_ref, COALESCE(i.kind, 'order') AS kind
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN products p ON p.id = r.product_id
  LEFT JOIN interactions i ON i.id = r.interaction_id
`;

export function listProductReviews(productId: string) {
  return many(`${REVIEW_SELECT} WHERE r.product_id = ? ORDER BY r.created_at DESC`, productId).map(mapReview);
}

export function listUserReviews(userId: string) {
  return many(`${REVIEW_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC`, userId).map(mapReview);
}

export function listAllReviews() {
  return many(`${REVIEW_SELECT} ORDER BY r.created_at DESC LIMIT 100`).map(mapReview);
}

export function listReviewableInteractions(userId: string, email: string) {
  return many(
    `${INTERACTION_SELECT}
     WHERE i.buyer_confirmed_at IS NOT NULL
       AND (i.buyer_id = ? OR lower(i.buyer_email) = ?)
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.interaction_id = i.id)
     ORDER BY i.buyer_confirmed_at DESC`,
    userId,
    email.toLowerCase(),
  ).map(mapInteraction);
}

export function insertReview(input: {
  id: string;
  userId: string;
  sellerId: string;
  productId: string;
  interactionId: string;
  overall: number;
  asDescribed: number;
  communication: number;
  reliability: number;
  quality: number | null;
  body: string;
  images: string[];
}) {
  db.prepare(
    `INSERT INTO reviews (
      id, user_id, seller_id, product_id, interaction_id, overall, as_described, communication, reliability, quality, body, images_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.sellerId,
    input.productId,
    input.interactionId,
    input.overall,
    input.asDescribed,
    input.communication,
    input.reliability,
    input.quality,
    input.body,
    JSON.stringify(input.images),
    new Date().toISOString(),
  );
}

export function updateReview(id: string, input: { overall: number; asDescribed: number; communication: number; reliability: number; quality: number | null; body: string }) {
  const result = db.prepare(
    `UPDATE reviews SET overall = ?, as_described = ?, communication = ?, reliability = ?, quality = ?, body = ? WHERE id = ?`,
  ).run(input.overall, input.asDescribed, input.communication, input.reliability, input.quality, input.body, id);
  return result.changes > 0;
}

export function reviewPlacement(id: string) {
  const row = one(
    `SELECT seller.username AS username, COALESCE(p.slug, '') AS slug
     FROM reviews r
     JOIN users seller ON seller.id = r.seller_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE r.id = ?`,
    id,
  );
  return row ? { username: str(row.username), slug: str(row.slug) } : null;
}

export function deleteReview(id: string) {
  const result = db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateDisplayName(id: string, displayName: string) {
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, id);
}

export function listBrowseHistory(userId: string) {
  return many(
    `SELECT p.*, u.username, u.display_name, MAX(v.created_at) AS seen_at
     FROM page_views v
     JOIN products p ON p.id = v.product_id
     JOIN users u ON u.id = p.user_id
     WHERE v.user_id = ? AND p.user_id != ?
     GROUP BY p.id
     ORDER BY seen_at DESC
     LIMIT 30`,
    userId,
    userId,
  ).map((row) => ({ product: mapPublic(row), seenAt: str(row.seen_at) }));
}

export function listAllProducts() {
  settleDeactivations();
  return many(
    `SELECT p.*, u.username, u.display_name FROM products p JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC`,
  ).map((row) => ({ ...mapProduct(row), username: str(row.username), displayName: str(row.display_name) }));
}

export type StoredLedgerEntry = {
  id: string;
  createdAt: string;
  orderId: string | null;
  sellerId: string;
  buyerId: string | null;
  account: LedgerAccount;
  entryType: LedgerEntryType;
  amountCents: number;
  currency: string;
  ownerKind: OwnerKind;
  ownerId: string;
  availableAt: string | null;
  memo: string;
};

export type MoneyOrder = {
  id: string;
  publicRef: string;
  sellerId: string;
  sellerName: string;
  buyerName: string;
  buyerPaidCents: number;
  stripeFeeCents: number;
  twigigiFeeCents: number;
  sellerNetCents: number;
  currency: string;
  paidAt: string | null;
  payoutEligibleAt: string | null;
  payoutCreatedAt: string | null;
  payoutCompletedAt: string | null;
  disputeStatus: string;
  bucket: MoneyBucket;
};

export type SellerBooks = {
  currency: string;
  buckets: Record<MoneyBucket, { cents: number; orders: MoneyOrder[] }>;
};

const EMPTY_BUCKETS = (): SellerBooks["buckets"] => ({
  protected: { cents: 0, orders: [] },
  available: { cents: 0, orders: [] },
  transit: { cents: 0, orders: [] },
  paid: { cents: 0, orders: [] },
});

function loadMoneyOrders(sellerId: string) {
  const rows = many(
    `SELECT o.id, o.public_ref, o.seller_id, o.buyer_name, o.currency, o.paid_at, o.payout_eligible_at,
            o.payout_created_at, o.payout_completed_at, o.dispute_status, o.payment_status, o.status,
            u.display_name AS seller_name,
            COALESCE(SUM(CASE WHEN l.account = 'processor' AND l.entry_type = 'PAYMENT' THEN l.amount_cents ELSE 0 END), 0) AS buyer_paid,
            COALESCE(SUM(CASE WHEN l.account = 'stripe' AND l.entry_type = 'STRIPE_FEE' THEN l.amount_cents ELSE 0 END), 0) AS stripe_fee,
            COALESCE(SUM(CASE WHEN l.account = 'operating' AND l.entry_type = 'TWIGIGI_FEE' THEN l.amount_cents ELSE 0 END), 0) AS twigigi_fee,
            COALESCE(SUM(CASE WHEN l.account = 'safeguarded' AND l.entry_type = 'SELLER_PAYABLE' THEN l.amount_cents ELSE 0 END), 0) AS seller_net
     FROM orders o
     JOIN users u ON u.id = o.seller_id
     LEFT JOIN ledger_entries l ON l.order_id = o.id
     WHERE (? = '' OR o.seller_id = ?)
     GROUP BY o.id
     ORDER BY o.paid_at DESC`,
    sellerId,
    sellerId,
  );
  const now = Date.now();
  const orders: MoneyOrder[] = [];
  for (const row of rows) {
    const sellerNetCents = num(row.seller_net);
    if (sellerNetCents <= 0 && num(row.buyer_paid) <= 0) continue;
    const bucket = moneyBucket({
      paid: row.payment_status === "paid" || row.status === "paid" || row.status === "fulfilled",
      disputeOpen: str(row.dispute_status) === "open",
      payoutCreatedAt: row.payout_created_at ? str(row.payout_created_at) : null,
      payoutCompletedAt: row.payout_completed_at ? str(row.payout_completed_at) : null,
      payoutEligibleAt: row.payout_eligible_at ? str(row.payout_eligible_at) : null,
      now,
    });
    if (!bucket) continue;
    orders.push({
      id: str(row.id),
      publicRef: str(row.public_ref),
      sellerId: str(row.seller_id),
      sellerName: str(row.seller_name),
      buyerName: str(row.buyer_name),
      buyerPaidCents: num(row.buyer_paid),
      stripeFeeCents: num(row.stripe_fee),
      twigigiFeeCents: num(row.twigigi_fee),
      sellerNetCents,
      currency: str(row.currency || "CAD"),
      paidAt: row.paid_at ? str(row.paid_at) : null,
      payoutEligibleAt: row.payout_eligible_at ? str(row.payout_eligible_at) : null,
      payoutCreatedAt: row.payout_created_at ? str(row.payout_created_at) : null,
      payoutCompletedAt: row.payout_completed_at ? str(row.payout_completed_at) : null,
      disputeStatus: str(row.dispute_status) || "none",
      bucket,
    });
  }
  return orders;
}

function groupBooks(orders: MoneyOrder[]): SellerBooks {
  const buckets = EMPTY_BUCKETS();
  for (const order of orders) {
    buckets[order.bucket].orders.push(order);
    buckets[order.bucket].cents += order.sellerNetCents;
  }
  return { currency: orders[0]?.currency ?? "CAD", buckets };
}

export function sellerBooks(sellerId: string) {
  return groupBooks(loadMoneyOrders(sellerId));
}

export function allMoneyOrders() {
  return loadMoneyOrders("");
}

export function listLedger(orderId: string): StoredLedgerEntry[] {
  return many(`SELECT * FROM ledger_entries WHERE order_id = ? ORDER BY created_at ASC, id ASC`, orderId).map((row) => ({
    id: str(row.id),
    createdAt: str(row.created_at),
    orderId: row.order_id ? str(row.order_id) : null,
    sellerId: str(row.seller_id),
    buyerId: row.buyer_id ? str(row.buyer_id) : null,
    account: str(row.account) as LedgerAccount,
    entryType: str(row.entry_type) as LedgerEntryType,
    amountCents: num(row.amount_cents),
    currency: str(row.currency),
    ownerKind: str(row.owner_kind) as OwnerKind,
    ownerId: str(row.owner_id),
    availableAt: row.available_at ? str(row.available_at) : null,
    memo: str(row.memo),
  }));
}

export function platformBooks() {
  const rows = many(`SELECT account, COALESCE(SUM(amount_cents), 0) AS n, MAX(currency) AS currency FROM ledger_entries GROUP BY account`);
  const byAccount: Record<string, number> = {};
  let currency = "CAD";
  for (const row of rows) {
    byAccount[str(row.account)] = num(row.n);
    if (row.currency) currency = str(row.currency);
  }
  return {
    currency,
    operatingCents: byAccount.operating ?? 0,
    safeguardedCents: byAccount.safeguarded ?? 0,
    transitCents: byAccount.transit ?? 0,
    paidOutCents: byAccount.external ?? 0,
    stripeFeeCents: byAccount.stripe ?? 0,
  };
}

export function listSellerAccounts() {
  const people = many(`SELECT id, display_name, email, username FROM users ORDER BY display_name ASC`);
  const orders = loadMoneyOrders("");
  return people.map((person) => {
    const id = str(person.id);
    return {
      id,
      displayName: str(person.display_name),
      email: str(person.email),
      username: str(person.username),
      books: groupBooks(orders.filter((order) => order.sellerId === id)),
    };
  });
}

function orderSellerNet(orderId: string) {
  const row = one(
    `SELECT COALESCE(SUM(amount_cents), 0) AS n FROM ledger_entries
     WHERE order_id = ? AND account = 'safeguarded' AND entry_type = 'SELLER_PAYABLE'`,
    orderId,
  );
  return num(row?.n);
}

export function startPayout(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.paymentStatus !== "paid") return { ok: false as const, error: "This order is not paid." };
  if (order.disputeStatus === "open") return { ok: false as const, error: "A dispute is open. The payout stays held." };
  if (order.payoutCreatedAt) return { ok: false as const, error: "Payout already started." };
  if (!order.payoutEligibleAt || Date.parse(order.payoutEligibleAt) > Date.now()) {
    return { ok: false as const, error: "Protection has not ended yet." };
  }
  const net = orderSellerNet(orderId);
  if (net <= 0) return { ok: false as const, error: "Nothing to pay out." };
  try {
    db.exec("BEGIN");
    appendLedger(db, { orderId, sellerId: order.sellerId, buyerId: order.buyerId, currency: order.currency, lines: payoutJournal(net) });
    const result = db.prepare(
      `UPDATE orders SET payout_status = 'processing', payout_created_at = ?, payout_amount = ?
       WHERE id = ? AND payout_created_at IS NULL`,
    ).run(new Date().toISOString(), net, orderId);
    if (result.changes !== 1) throw new Error("Payout was already recorded.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("already recorded")) return { ok: false as const, error: "Payout was already recorded." };
    return { ok: false as const, error: "Could not record the payout." };
  }
  return { ok: true as const };
}

export function completePayout(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (!order.payoutCreatedAt || order.payoutCompletedAt) return { ok: false as const, error: "This payout is not on the way." };
  const net = orderSellerNet(orderId);
  if (net <= 0) return { ok: false as const, error: "Nothing to pay out." };
  try {
    db.exec("BEGIN");
    appendLedger(db, { orderId, sellerId: order.sellerId, buyerId: order.buyerId, currency: order.currency, lines: payoutCompletedJournal(net) });
    const result = db.prepare(
      `UPDATE orders SET payout_status = 'paid', payout_completed_at = ? WHERE id = ? AND payout_completed_at IS NULL`,
    ).run(new Date().toISOString(), orderId);
    if (result.changes !== 1) throw new Error("Payout was already completed.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("already completed")) return { ok: false as const, error: "Payout was already completed." };
    return { ok: false as const, error: "Could not record the payout." };
  }
  return { ok: true as const };
}

export function setDispute(orderId: string, open: boolean) {
  const order = getOrder(orderId);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.payoutCreatedAt) return { ok: false as const, error: "The payout has already left safeguarded funds." };
  const next = open ? "open" : "none";
  const current = open ? "none" : "open";
  const lines: LedgerDraft[] = [
    {
      account: "safeguarded",
      entryType: open ? "DISPUTE_OPENED" : "DISPUTE_CLOSED",
      amountCents: 0,
      ownerKind: "seller",
      availableAt: order.payoutEligibleAt,
      memo: open ? "Dispute opened. Seller payout stays held." : "Dispute closed.",
    },
  ];
  try {
    db.exec("BEGIN");
    const result = db.prepare(`UPDATE orders SET dispute_status = ? WHERE id = ? AND dispute_status = ?`).run(next, orderId, current);
    if (result.changes !== 1) throw new Error("Dispute status did not change.");
    appendLedger(db, { orderId, sellerId: order.sellerId, buyerId: order.buyerId, currency: order.currency, lines });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return { ok: false as const, error: error instanceof Error && error.message.includes("did not change") ? "That dispute is already recorded." : "Could not record the dispute." };
  }
  return { ok: true as const };
}

export function updateOrderStatus(id: string, userId: string, status: OrderStatus) {
  const result = db
    .prepare(
      `UPDATE orders SET status = ?
       WHERE id = ? AND product_id IN (SELECT id FROM products WHERE user_id = ?)`,
    )
    .run(status, id, userId);
  if (result.changes > 0 && (status === "paid" || status === "fulfilled")) beginPaymentProtection(id);
  return result.changes > 0;
}

export function insertQuote(input: {
  id: string;
  productId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  quantity: number;
  projectDetails: string;
  documents: { path: string; name: string }[];
  src: string;
}) {
  db.prepare(
    `INSERT INTO quotes (
      id, product_id, name, email, phone, message, quantity, project_details, documents_json, status, src, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
  ).run(
    input.id,
    input.productId,
    input.name,
    input.email,
    input.phone,
    input.message,
    input.quantity,
    input.projectDetails,
    JSON.stringify(input.documents),
    input.src,
    new Date().toISOString(),
  );
}

const QUOTE_SELECT = `
  SELECT q.*, p.title AS product_title, p.slug AS product_slug, u.username
  FROM quotes q
  JOIN products p ON p.id = q.product_id
  JOIN users u ON u.id = p.user_id
`;

export function getQuote(id: string) {
  const row = one(`${QUOTE_SELECT} WHERE q.id = ?`, id);
  return row ? mapQuote(row) : null;
}

export function listQuotes(userId: string) {
  return many(`${QUOTE_SELECT} WHERE p.user_id = ? ORDER BY q.created_at DESC LIMIT 100`, userId).map(mapQuote);
}

export function updateQuoteStatus(id: string, userId: string, status: QuoteRecord["status"]) {
  const result = db
    .prepare(
      `UPDATE quotes SET status = ?
       WHERE id = ? AND product_id IN (SELECT id FROM products WHERE user_id = ?)`,
    )
    .run(status, id, userId);
  return result.changes > 0;
}

export function insertMessage(input: {
  id: string;
  productId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  src: string;
}) {
  db.prepare(
    `INSERT INTO messages (id, product_id, name, email, phone, message, status, src, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
  ).run(
    input.id,
    input.productId,
    input.name,
    input.email,
    input.phone,
    input.message,
    input.src,
    new Date().toISOString(),
  );
}

const MESSAGE_SELECT = `
  SELECT m.*, p.title AS product_title, p.slug AS product_slug, u.username
  FROM messages m
  JOIN products p ON p.id = m.product_id
  JOIN users u ON u.id = p.user_id
`;

export function getMessage(id: string) {
  const row = one(`${MESSAGE_SELECT} WHERE m.id = ?`, id);
  return row ? mapMessage(row) : null;
}

export function listMessages(userId: string) {
  return many(`${MESSAGE_SELECT} WHERE p.user_id = ? ORDER BY m.created_at DESC LIMIT 12`, userId).map(mapMessage);
}

export function updateMessageStatus(id: string, userId: string, status: MessageRecord["status"]) {
  const result = db
    .prepare(
      `UPDATE messages SET status = ?
       WHERE id = ? AND product_id IN (SELECT id FROM products WHERE user_id = ?)`,
    )
    .run(status, id, userId);
  return result.changes > 0;
}

function seedIfEmpty() {
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = one("SELECT COUNT(*) AS n FROM users");
    if (num(existing?.n) > 0) {
      db.exec("COMMIT");
      return;
    }
    const now = "2026-10-01T15:00:00.000Z";
    const passwordHash = bcrypt.hashSync("planter-demo", 10);
    db.prepare(
      "INSERT INTO users (id, email, password_hash, username, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("usr_ava", "ava@twigigi.demo", passwordHash, "ava", "Ava Chen", now);

    const insert = db.prepare(
      `INSERT INTO products (
        id, user_id, slug, title, description, price_cents, currency, location, video_url,
        pickup_enabled, pickup_note, delivery_enabled, delivery_radius_km, delivery_fee_cents,
        shipping_enabled, shipping_fee_cents, shipping_note, cta, contact_email, contact_phone,
        status, images_json, view_count, created_at, updated_at
      ) VALUES (?, 'usr_ava', ?, ?, ?, ?, 'CAD', 'Edmonton, Alberta', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    );

    insert.run(
      "prd_cedar",
      "cedar-planter",
      "Cedar planter box",
      "A solid cedar planter, 36 inches long, built for Alberta winters. Untreated wood with a linseed finish and drainage included. Made to order in small batches.",
      12800,
      1,
      "Pickup in Windermere. We'll text a two-hour window after you order. The street address stays private.",
      1,
      25,
      1800,
      0,
      null,
      "",
      "buy",
      "ava@twigigi.demo",
      "780-555-0148",
      "published",
      JSON.stringify(["/seed/cedar-1.jpg", "/seed/cedar-2.jpg"]),
      now,
      now,
    );

    insert.run(
      "prd_bench",
      "garden-bench",
      "Custom garden bench",
      "A bench made to the length of your entry or garden bed. Tell me the size, the wood, and whether it needs to live outside all year.",
      null,
      1,
      "Pickup in the southwest once it's finished.",
      1,
      30,
      null,
      0,
      null,
      "",
      "quote",
      "ava@twigigi.demo",
      "780-555-0148",
      "published",
      JSON.stringify(["/seed/bench-1.jpg", "/seed/bench-2.jpg"]),
      now,
      "2026-10-08T15:00:00.000Z",
    );

    insert.run(
      "prd_wreath",
      "wreath-workshop",
      "Holiday wreath workshop",
      "A two-hour evening workshop for cedar and dried-flower wreaths. Still a draft.",
      4500,
      1,
      "Southwest Edmonton. Address shared after you write.",
      0,
      null,
      null,
      0,
      null,
      "",
      "contact",
      "ava@twigigi.demo",
      "780-555-0148",
      "draft",
      JSON.stringify(["/seed/wreath-1.jpg"]),
      now,
      "2026-10-18T15:00:00.000Z",
    );
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The statement error may already have ended the transaction.
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("constraint")) return;
    throw error;
  }
}

function ensureConsultPage() {
  if (one("SELECT id FROM products WHERE id = ?", "prd_consult")) return;
  if (!one("SELECT id FROM users WHERE id = ?", "usr_ava")) return;
  const now = "2026-10-12T15:00:00.000Z";
  db.prepare(
    `INSERT INTO products (
      id, user_id, slug, title, description, price_cents, currency, location, video_url,
      pickup_enabled, pickup_note, delivery_enabled, delivery_radius_km, delivery_fee_cents,
      shipping_enabled, shipping_fee_cents, shipping_note, cta, contact_email, contact_phone,
      status, images_json, view_count, created_at, updated_at
    ) VALUES (
      'prd_consult', 'usr_ava', 'garden-consult', ?, ?, NULL, 'CAD', 'Edmonton, Alberta', NULL,
      1, ?, 0, NULL, NULL,
      0, NULL, '', 'contact', 'ava@twigigi.demo', '780-555-0148',
      'published', ?, 0, ?, ?
    )`,
  ).run(
    "Garden bed consult",
    "A short visit to look at light, soil, and what is worth planting this season. Write with the neighbourhood and a photo of the bed.",
    "We meet in your neighbourhood. The exact address stays in the message, not on this Twig.",
    JSON.stringify(["/seed/consult-1.jpg"]),
    now,
    now,
  );
}

function ensureDemoReviews() {
  const product = (slug: string) =>
    one(
      `SELECT p.id AS id, p.user_id AS seller_id
       FROM products p JOIN users u ON u.id = p.user_id
       WHERE lower(u.username) = 'ava' AND p.slug = ?`,
      slug,
    );
  const cedar = product("cedar-planter");
  const bench = product("garden-bench");
  if (!cedar && !bench) return;
  const expected = (cedar ? 3 : 0) + (bench ? 2 : 0);
  const seeded = one("SELECT COUNT(*) AS n FROM reviews WHERE id LIKE 'rev_demo_%'");
  if (num(seeded?.n) >= expected) return;
  const passwordHash = bcrypt.hashSync(`${crypto.randomUUID()}${crypto.randomUUID()}`, 10);
  const people = [
    ["usr_demo_maya", "maya.hale@twigigi.demo", "maya-hale", "Maya Hale", "2026-09-02T15:00:00.000Z"],
    ["usr_demo_owen", "owen.park@twigigi.demo", "owen-park", "Owen Park", "2026-09-04T15:00:00.000Z"],
    ["usr_demo_lina", "lina.cho@twigigi.demo", "lina-cho", "Lina Cho", "2026-09-06T15:00:00.000Z"],
    ["usr_demo_noah", "noah.reid@twigigi.demo", "noah-reid", "Noah Reid", "2026-09-08T15:00:00.000Z"],
    ["usr_demo_priya", "priya.shah@twigigi.demo", "priya-shah", "Priya Shah", "2026-09-10T15:00:00.000Z"],
  ] as const;
  const insertUser = db.prepare(
    `INSERT INTO users (id, email, password_hash, username, display_name, role, created_at)
     SELECT ?, ?, ?, ?, ?, 'user', ?
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = ? OR lower(email) = lower(?) OR lower(username) = lower(?))`,
  );
  for (const [id, email, username, displayName, createdAt] of people) {
    insertUser.run(id, email, passwordHash, username, displayName, createdAt, id, email, username);
  }
  const insertInteraction = db.prepare(
    `INSERT INTO interactions (
      id, public_ref, kind, source_id, product_id, seller_id, buyer_id, buyer_email, buyer_confirmed_at, seller_confirmed_at, created_at
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM interactions WHERE id = ? OR source_id = ? OR public_ref = ?)`,
  );
  const insertReview = db.prepare(
    `INSERT INTO reviews (
      id, user_id, seller_id, product_id, interaction_id, overall, as_described, communication, reliability, quality, body, images_json, created_at
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?
      WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE id = ? OR interaction_id = ?)`,
  );
  const reviews = [
    cedar && {
      id: "rev_demo_cedar_1",
      userId: "usr_demo_maya",
      email: "maya.hale@twigigi.demo",
      productId: str(cedar.id),
      sellerId: str(cedar.seller_id),
      interactionId: "int_demo_cedar_1",
      publicRef: "IX-D01",
      kind: "order",
      overall: 5,
      asDescribed: 5,
      communication: 5,
      reliability: 5,
      quality: null,
      body: "Solid cedar, and the drainage actually works. It sat outside through a wet week and the wood still looks clean.",
      at: "2026-09-14T18:00:00.000Z",
    },
    cedar && {
      id: "rev_demo_cedar_2",
      userId: "usr_demo_owen",
      email: "owen.park@twigigi.demo",
      productId: str(cedar.id),
      sellerId: str(cedar.seller_id),
      interactionId: "int_demo_cedar_2",
      publicRef: "IX-D02",
      kind: "order",
      overall: 5,
      asDescribed: 5,
      communication: 5,
      reliability: 4,
      quality: null,
      body: "Exactly as described. Pickup was easy, and Ava answered the size questions the same day.",
      at: "2026-09-28T18:00:00.000Z",
    },
    cedar && {
      id: "rev_demo_cedar_3",
      userId: "usr_demo_lina",
      email: "lina.cho@twigigi.demo",
      productId: str(cedar.id),
      sellerId: str(cedar.seller_id),
      interactionId: "int_demo_cedar_3",
      publicRef: "IX-D03",
      kind: "order",
      overall: 4,
      asDescribed: 4,
      communication: 5,
      reliability: 5,
      quality: null,
      body: "Beautiful planter. A little heavier than I expected, but the finish is even and it fits the entry.",
      at: "2026-10-09T18:00:00.000Z",
    },
    bench && {
      id: "rev_demo_bench_1",
      userId: "usr_demo_noah",
      email: "noah.reid@twigigi.demo",
      productId: str(bench.id),
      sellerId: str(bench.seller_id),
      interactionId: "int_demo_bench_1",
      publicRef: "IX-D04",
      kind: "quote",
      overall: 5,
      asDescribed: 5,
      communication: 5,
      reliability: 5,
      quality: 5,
      body: "Built to the length I asked for. Communication stayed clear from the quote through pickup.",
      at: "2026-09-20T18:00:00.000Z",
    },
    bench && {
      id: "rev_demo_bench_2",
      userId: "usr_demo_priya",
      email: "priya.shah@twigigi.demo",
      productId: str(bench.id),
      sellerId: str(bench.seller_id),
      interactionId: "int_demo_bench_2",
      publicRef: "IX-D05",
      kind: "quote",
      overall: 5,
      asDescribed: 5,
      communication: 5,
      reliability: 5,
      quality: 5,
      body: "Sturdy, and the wood choice was explained properly. It has lived outside since the week it arrived.",
      at: "2026-10-16T18:00:00.000Z",
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const review of reviews) {
      const buyer = one("SELECT id FROM users WHERE id = ?", review.userId);
      if (!buyer) continue;
      insertInteraction.run(
        review.interactionId,
        review.publicRef,
        review.kind,
        review.interactionId,
        review.productId,
        review.sellerId,
        review.userId,
        review.email,
        review.at,
        review.at,
        review.at,
        review.interactionId,
        review.interactionId,
        review.publicRef,
      );
      insertReview.run(
        review.id,
        review.userId,
        review.sellerId,
        review.productId,
        review.interactionId,
        review.overall,
        review.asDescribed,
        review.communication,
        review.reliability,
        review.quality,
        review.body,
        review.at,
        review.id,
        review.interactionId,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The statement error may already have ended the transaction.
    }
    throw error;
  }
}

seedIfEmpty();
ensureConsultPage();
ensureDemoReviews();
