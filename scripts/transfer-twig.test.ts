import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { deleteProduct, findUserByEmail, getProductById, getPublishedProduct, insertProduct, transferProductOwner, writeQuoteTwigSettings } from "../lib/db.ts";

const root = path.resolve(import.meta.dirname, "..");
const copyId = "prd_transfer_probe";
const siblingId = "prd_transfer_sibling";
const orderId = "ord_transfer_probe";
const paidBillId = "bill_transfer_paid";
const dueBillId = "bill_transfer_due";
const title = "Transfer probe";
const profileName = "Transfer Probe Yard";

function open() {
  return new DatabaseSync(path.join(root, "data", "twigigi.db"));
}

test("transferring a Twig makes it a draft the new seller must pay to publish", () => {
  const sourceUser = findUserByEmail("ava@twigigi.demo");
  const targetUser = findUserByEmail("maya.hale@twigigi.demo");
  const source = getProductById("prd_plan");
  assert.ok(sourceUser && targetUser && source);
  const database = open();
  database.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  database.prepare("DELETE FROM twig_bills WHERE id IN (?, ?)").run(paidBillId, dueBillId);
  database.prepare("DELETE FROM business_profiles WHERE user_id = ? AND name = ?").run(targetUser.id, profileName);
  database.close();
  deleteProduct(copyId, sourceUser.id);
  deleteProduct(copyId, targetUser.id);
  deleteProduct(siblingId, targetUser.id);

  insertProduct(copyId, sourceUser.id, { ...source, slug: "transfer-probe", title, status: "published", cta: "quote" });
  insertProduct(siblingId, targetUser.id, { ...source, slug: "transfer-probe-sibling", title, status: "draft", cta: "quote" });
  writeQuoteTwigSettings({
    productId: copyId,
    businessName: profileName,
    businessBio: "Probe bio",
    businessLogo: "",
    caseImages: [],
    profileSkipped: false,
    visitEnabled: false,
    offerEnabled: false,
    invoiceEnabled: false,
  });
  const setup = open();
  setup.prepare(
    `UPDATE products
     SET fee_exempt = 1, quote_fee_exempt = 1, paid_until = '2099-01-01T00:00:00.000Z', billing_status = 'active',
         billing_anchor_day = 15, auto_renew = 1, demo = 0
     WHERE id = ?`,
  ).run(copyId);
  setup.prepare(
    `INSERT INTO orders (
       id, product_id, seller_id, buyer_name, email, phone, quantity, fulfillment, amount_cents, currency, status, created_at
     ) VALUES (?, ?, ?, 'Buyer', 'buyer@example.com', '', 1, 'pickup', 1000, 'CAD', 'paid', ?)`,
  ).run(orderId, copyId, sourceUser.id, "2026-11-01T00:00:00.000Z");
  setup.prepare(
    `INSERT INTO twig_bills (
       id, user_id, product_id, amount_cents, currency, method, kind, period_start, period_end, status, created_at, billing_period_key
     ) VALUES (?, ?, ?, 499, 'CAD', '', 'listing', '2026-11-01', '2026-12-01', 'paid', '2026-11-01T00:00:00.000Z', ?)`,
  ).run(paidBillId, sourceUser.id, copyId, `first:${copyId}`);
  setup.prepare(
    `INSERT INTO twig_bills (
       id, user_id, product_id, amount_cents, currency, method, kind, period_start, period_end, status, created_at, billing_period_key
     ) VALUES (?, ?, ?, 499, 'CAD', '', 'listing', '2026-12-01', '2027-01-01', 'due', '2026-12-01T00:00:00.000Z', '2026-12-15')`,
  ).run(dueBillId, sourceUser.id, copyId);
  setup.close();

  try {
    assert.equal(transferProductOwner(copyId, sourceUser.id).ok, false);
    const blocked = getProductById(copyId);
    assert.equal(blocked?.userId, sourceUser.id);
    setupDemo(copyId, 1);
    assert.deepEqual(transferProductOwner(copyId, targetUser.id), { ok: false, reason: "demo" });
    setupDemo(copyId, 0);

    const moved = transferProductOwner(copyId, targetUser.id);
    assert.equal(moved.ok, true);
    const product = getProductById(copyId);
    const sibling = getProductById(siblingId);
    assert.equal(product?.userId, targetUser.id);
    assert.equal(product?.status, "draft");
    assert.equal(product?.feeExempt, false);
    assert.equal(product?.quoteFeeExempt, false);
    assert.equal(product?.paidUntil, null);
    assert.equal(product?.billingStatus, "");
    assert.equal(product?.billingAnchorDay, 0);
    assert.equal(product?.autoRenew, false);
    assert.ok(product?.draftKey);
    assert.notEqual(product?.draftKey, sibling?.draftKey);
    assert.ok(sibling?.draftKey);
    assert.equal(getPublishedProduct(targetUser.publicId, product?.slug || ""), null);

    const check = open();
    const paid = check.prepare("SELECT user_id, status, billing_period_key FROM twig_bills WHERE id = ?").get(paidBillId) as { user_id: string; status: string; billing_period_key: string };
    const due = check.prepare("SELECT status, billing_period_key FROM twig_bills WHERE id = ?").get(dueBillId) as { status: string; billing_period_key: string };
    const order = check.prepare("SELECT seller_id FROM orders WHERE id = ?").get(orderId) as { seller_id: string };
    const profile = check.prepare("SELECT bio FROM business_profiles WHERE user_id = ? AND name = ?").get(targetUser.id, profileName) as { bio: string } | undefined;
    check.close();
    assert.equal(paid.user_id, sourceUser.id);
    assert.equal(paid.status, "paid");
    assert.equal(paid.billing_period_key, `transferred:${paidBillId}`);
    assert.equal(due.status, "void");
    assert.equal(due.billing_period_key, `transferred:${dueBillId}`);
    assert.equal(order.seller_id, sourceUser.id);
    assert.equal(profile?.bio, "Probe bio");
  } finally {
    const cleanup = open();
    cleanup.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
    cleanup.prepare("DELETE FROM twig_bills WHERE product_id = ?").run(copyId);
    cleanup.prepare("DELETE FROM quote_twig_settings WHERE product_id IN (?, ?)").run(copyId, siblingId);
    cleanup.prepare("DELETE FROM business_profiles WHERE user_id = ? AND name = ?").run(targetUser.id, profileName);
    cleanup.close();
    deleteProduct(copyId, targetUser.id);
    deleteProduct(copyId, sourceUser.id);
    deleteProduct(siblingId, targetUser.id);
  }
});

function setupDemo(id: string, demo: number) {
  const database = open();
  database.prepare("UPDATE products SET demo = ? WHERE id = ?").run(demo, id);
  database.close();
}
