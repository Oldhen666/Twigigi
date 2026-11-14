import { DatabaseSync } from "node:sqlite";
import { businessDate, dateKey, secondBillingKey } from "../lib/billing-calendar.ts";

const databasePath = process.argv[2] || "data/twigigi.db";
const database = new DatabaseSync(databasePath, { readOnly: true });
const columns = new Set(
  (database.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>).map((row) => row.name),
);
const started = columns.has("billing_started_at") ? "billing_started_at" : "''";
const anchor = columns.has("billing_anchor_day") ? "billing_anchor_day" : "0";
const products = database.prepare(
  `SELECT id, title, status, ${started} AS started_at, ${anchor} AS anchor_day, paid_until
   FROM products
   WHERE status IN ('published', 'deactivated')`,
).all() as Array<{ id: string; title: string; status: string; started_at: string; anchor_day: number; paid_until: string }>;

console.log("Dry run only. No rows are updated.");
console.log(`Database: ${databasePath}`);
for (const product of products) {
  const first = database.prepare(
    `SELECT paid_at, period_start, status FROM twig_bills
     WHERE product_id = ? AND kind = 'listing'
     ORDER BY created_at ASC LIMIT 1`,
  ).get(product.id) as { paid_at?: string; period_start?: string; status?: string } | undefined;
  const source = product.started_at || first?.paid_at || first?.period_start || "";
  const date = source ? businessDate(source) : null;
  const proposed = date ? (date.day <= 15 ? 15 : 28) : 0;
  const next = source ? secondBillingKey(source) : "";
  console.log([
    product.id,
    product.status,
    `stored anchor ${product.anchor_day || "none"}`,
    `proposed ${proposed || "unset"}`,
    next ? `next month example ${next}` : "no paid start",
    first?.status === "paid" ? "has a paid bill; leave it unchanged" : "no paid listing bill",
  ].join(" | "));
}
const paid = database.prepare("SELECT COUNT(*) AS n FROM twig_bills WHERE status = 'paid'").get() as { n: number };
console.log(`Paid bills left untouched: ${paid.n}`);
console.log("Unpaid bills are not recalculated by this script.");
database.close();
