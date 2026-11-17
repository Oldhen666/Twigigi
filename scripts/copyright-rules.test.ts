import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { COPYRIGHT_POLICY_VERSION, IP_POLICY_VERSION, TERMS_VERSION } from "../lib/legal.ts";
import {
  digitalContentVersion,
  digitalRightsDue,
  enforcementNeedsConfirm,
  enforcementNotice,
  sellerMayPublish,
  twigigiFileHeld,
} from "../lib/copyright.ts";
import {
  confirmDigitalRights,
  deleteProduct,
  getCopyrightAppeal,
  getContentReport,
  getProductById,
  insertContentReport,
  insertCopyrightAppeal,
  insertProduct,
  setProductFileAccess,
  setProductModeration,
  updateProduct,
} from "../lib/db.ts";

const root = path.resolve(import.meta.dirname, "..");

test("a digital file cannot be treated as confirmed until the current policy and content match", () => {
  const links = ["https://drive.google.com/file/a"];
  const images = ["/uploads/a.jpg"];
  assert.equal(digitalRightsDue({
    confirmed: false,
    confirmedVersion: "",
    confirmedPolicy: "",
    fileLinks: links,
    images,
    imagesChanged: false,
  }), true);
  const version = digitalContentVersion(links, images);
  assert.equal(digitalRightsDue({
    confirmed: true,
    confirmedVersion: version,
    confirmedPolicy: COPYRIGHT_POLICY_VERSION,
    fileLinks: links,
    images,
    imagesChanged: false,
  }), false);
  assert.equal(digitalRightsDue({
    confirmed: true,
    confirmedVersion: version,
    confirmedPolicy: COPYRIGHT_POLICY_VERSION,
    fileLinks: ["https://drive.google.com/file/b"],
    images,
    imagesChanged: false,
  }), true);
  assert.equal(digitalRightsDue({
    confirmed: true,
    confirmedVersion: version,
    confirmedPolicy: COPYRIGHT_POLICY_VERSION,
    fileLinks: links,
    images,
    imagesChanged: true,
  }), true);
  assert.equal(digitalRightsDue({
    confirmed: true,
    confirmedVersion: version,
    confirmedPolicy: IP_POLICY_VERSION,
    fileLinks: links,
    images,
    imagesChanged: false,
  }), true);
});

test("held files and restricted sellers cannot be offered or published", () => {
  assert.equal(twigigiFileHeld({ fileAccess: "restricted", moderationStatus: "" }, { suspended: false, banned: false }), true);
  assert.equal(twigigiFileHeld({ fileAccess: "", moderationStatus: "restricted" }, null), true);
  assert.equal(twigigiFileHeld({ fileAccess: "", moderationStatus: "" }, { suspended: true, banned: false }), true);
  assert.equal(twigigiFileHeld({ fileAccess: "", moderationStatus: "" }, { suspended: false, banned: false }), false);
  assert.equal(sellerMayPublish({ suspended: false, banned: false, publishRestricted: true }), false);
  assert.equal(sellerMayPublish({ suspended: false, banned: false, publishRestricted: false }), true);
  const notice = enforcementNotice({ productTitle: "Garden plan", actionLabel: "Pause listing", reason: "Missing permission", deadline: "2026-11-23" });
  assert.match(notice, /Garden plan/);
  assert.match(notice, /Pause listing/);
  assert.match(notice, /Respond by: 2026-11-23/);
  assert.match(notice, /\/legal\/copyright-appeal/);
  assert.match(notice, /outside Twigigi/);
  assert.equal(enforcementNeedsConfirm("ban"), true);
  assert.equal(enforcementNeedsConfirm("request_documents"), false);
});

test("seller edits do not clear an admin file restriction, and reports and appeals are stored", () => {
  const source = getProductById("prd_plan");
  assert.ok(source, "demo digital file is missing");
  const id = "prd_rights_probe";
  const slug = "rights-probe-temp";
  deleteProduct(id, source.userId);
  insertProduct(id, source.userId, { ...source, slug, title: "Rights probe", status: "draft" });
  let reportId = "";
  let appealId = "";
  try {
    assert.equal(getProductById(id)?.rightsConfirmed, false);
    const links = ["https://example.com/original.zip"];
    const images = source.images;
    confirmDigitalRights(id, source.userId, TERMS_VERSION, COPYRIGHT_POLICY_VERSION, digitalContentVersion(links, images));
    const confirmed = getProductById(id);
    assert.equal(confirmed?.rightsConfirmed, true);
    assert.equal(confirmed?.rightsUserId, source.userId);
    assert.equal(confirmed?.rightsIpVersion, COPYRIGHT_POLICY_VERSION);
    assert.equal(confirmed?.rightsContentVersion, digitalContentVersion(links, images));
    assert.ok(confirmed?.rightsConfirmedAt);

    setProductFileAccess(id, "restricted");
    setProductModeration(id, "restricted");
    updateProduct(id, source.userId, { ...source, slug, title: "Rights probe", status: "draft", fileLinks: ["https://example.com/replacement.zip"] });
    const afterEdit = getProductById(id);
    assert.equal(afterEdit?.fileAccess, "restricted");
    assert.equal(afterEdit?.moderationStatus, "restricted");
    assert.equal(twigigiFileHeld(afterEdit, { suspended: false, banned: false }), true);
    assert.deepEqual(afterEdit?.fileLinks, ["https://example.com/replacement.zip"]);

    reportId = insertContentReport({
      kind: "ip",
      reporterUserId: null,
      reporterName: "Rights Probe",
      reporterEmail: "rights-probe@example.com",
      company: "",
      reason: "",
      rightType: "copyright",
      protectedWork: "Original garden drawing",
      contentUrl: "https://twigigi.com/u6f82da60f183/garden-bed-plan",
      productId: id,
      ownerUserId: source.userId,
      description: "The listing copies the drawing.",
      evidence: "https://example.com/original",
      signature: "Rights Probe",
      policyVersion: COPYRIGHT_POLICY_VERSION,
      rightsHolder: "Rights Probe",
      relationship: "owner",
    });
    const report = getContentReport(reportId);
    assert.equal(report?.rightsHolder, "Rights Probe");
    assert.equal(report?.relationship, "owner");
    assert.equal(report?.status, "submitted");

    appealId = insertCopyrightAppeal({
      userId: source.userId,
      productId: id,
      statement: "I have a licence to sell this file.",
      evidence: "https://example.com/licence",
    });
    const appeal = getCopyrightAppeal(appealId);
    assert.equal(appeal?.status, "submitted");
    assert.match(appeal?.statement ?? "", /licence/);
    assert.equal(appeal?.sellerEmail.length ? appeal.sellerEmail.includes("@") : true, true);
  } finally {
    const db = new DatabaseSync(path.join(root, "data", "twigigi.db"));
    if (reportId) db.prepare("DELETE FROM content_reports WHERE id = ?").run(reportId);
    if (appealId) db.prepare("DELETE FROM copyright_appeals WHERE id = ?").run(appealId);
    db.close();
    deleteProduct(id, source.userId);
  }
  assert.equal(getProductById(id), null);
});

test("admin copyright actions require an admin session", () => {
  const actions = fs.readFileSync(path.join(root, "lib", "actions.ts"), "utf8");
  const action = actions.slice(actions.indexOf("export async function adminCopyrightAction"), actions.indexOf("export async function submitCopyrightAppeal"));
  assert.match(action, /const admin = await requireAdmin\(\)/);
  const review = actions.slice(actions.indexOf("export async function adminReviewAppeal"));
  assert.match(review, /const admin = await requireAdmin\(\)/);
  const db = fs.readFileSync(path.join(root, "lib", "db.ts"), "utf8");
  const updateSql = db.slice(db.indexOf("export function updateProduct"), db.indexOf("export function setDeactivatesAt"));
  assert.doesNotMatch(updateSql, /file_access|moderation_status|publish_restricted/);
});
