"use server";

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { updateTag } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { placeProblem, splitLocation } from "@/lib/places";
import { cardLinkProblem, digitalPayMethods, interacEmailProblem, isCashMethod, isTransferMethod, methodLabel, methodsForFulfillment, parsePaymentMethods, paypalMeName, paypalMeProblem, safeEmail, sellerContactProblem, stripeConnectCountry, venmoUsernameFrom, venmoUsernameProblem } from "@/lib/payments";
import { beginDigitalPaypalCheckout, beginPaypalBillingAgreement, createPlatformFeeCheckout, paypalBillingMessage, paypalCheckoutError, paypalConfigured } from "@/lib/paypal";
import { plansFor, prepareRenewalBills } from "@/lib/seller-fees";
import { activePlanQuote, digitalChangeMessage, digitalPublishMessage, snapshotPlatformFee } from "@/lib/digital-plans";
import { activeBuyQuote, buyPlanChange, optionAllowed, publishBuyOffer, publishChoice, quoteBuyPlan, recommendBuyTarget } from "@/lib/buy-plans";
import { firstCoverage, nextPeriodBill } from "@/lib/billing-calendar";
import { clearSession, getCurrentUser, getImpersonation, requireAdmin, requireSeller, requireUser, setSession } from "@/lib/auth";
import { productTag, sellerTag } from "@/lib/catalog";
import { deliverPaidFile, sendPaymentConfirmed } from "@/lib/file-delivery";
import { acceptNote, notifyBuyer, readyNote } from "@/lib/order-notices";
import { fulfillmentDone, sellerBulkActions, shipsToBuyer, type SellerBulkAction } from "@/lib/order-flow";
import { parseFileLinks } from "@/lib/files";
import { addProof, answerFromBuyer, decideProof, emptyPersonalization, emptySnapshot, legacyUploadPersonalization, personalizationFromSeller, PERSONALIZATION_FILE_LIMIT } from "@/lib/personalization";
import { descriptionPlain, storedDescription } from "@/lib/rich-text";
import { resolveUpload, uploadDirectory } from "@/lib/uploads";
import {
  cancelDigitalPlan,
  cancelBuyPlan,
  cancelUnpaidDigitalOrder,
  claimDigitalFilePublish,
  claimBuyNowPublish,
  commitDigitalPlan,
  commitBuyPlan,
  claimBuyerOrders,
  createUser,
  clearDeactivatesAt,
  clearDeactivatedAt,
  adminDeleteProduct,
  deleteProduct,
  deleteUserAccount,
  duplicateProduct,
  confirmListingRights,
  confirmDigitalRights,
  setProductFileAccess,
  setUserPublishRestricted,
  setUserBanned,
  insertSellerNotice,
  insertCopyrightAppeal,
  getCopyrightAppeal,
  updateCopyrightAppeal,
  findListingByPath,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  readDigitalSubscription,
  readBuySubscription,
  getOrder,
  setOrderFileIssue,
  getProductById,
  getDraftByKey,
  getRecentDraftByTitle,
  claimDraftKey,
  getQuote,
  writeQuoteTwigSettings,
  readQuoteTwigSettings,
  readQuoteListingCharge,
  quoteFollowups,
  quoteFollowupCovered,
  quoteFollowupByToken,
  draftQuoteFollowup,
  sendQuoteFollowup,
  chargeQuoteFollowup,
  answerQuoteFollowup,
  payQuoteInvoice,
  insertContentReport,
  insertModerationEvent,
  insertMessage,
  insertOrder,
  setOrderCustomImages,
  setOrderPersonalization,
  acceptPlacedOrder,
  insertProduct,
  insertQuote,
  hasBillableQuote,
  quoteRequestKey,
  insertReview,
  openInteraction,
  confirmInteractionParty,
  adminSetConfirmation,
  updateReview,
  deleteReview,
  reviewPlacement,
  updateContentReport,
  updateDisplayName,
  updateUserBio,
  getContentReport,
  getInteraction,
  getInteractionBySource,
  productHasActivity,
  recordLegalAcceptance,
  releaseStock,
  reserveStock,
  setOrderChoices,
  setOrderPaymentSnapshot,
  setOrderPlatformFee,
  setOrderStripeAccount,
  setStripeAccount,
  rememberStripeCustomer,
  recordBillingConsent,
  setBillingAutoPay,
  resumeCardAuthorization,
  revokeCardAuthorization,
  collectionForSeller,
  confirmProviderPayment,
  setBuyerPaymentMethod,
  recordPaymentLinkChange,
  setInteracPrompt,
  sellerReviewOrder,
  acceptOrderProposal,
  confirmOrderPaymentReceived,
  confirmOrderPickupTime,
  confirmBuyerPickupTime,
  confirmCashHandover,
  setSellerPickupTime,
  setSellerPickupOptions,
  requestAnotherPickupTime,
  addPickupMessage,
  rollbackOrderStatus,
  recordBuyerPayment,
  markOrderFulfillment,
  confirmBuyerReceipt,
  completeSellerOrder,
  deactivateNow,
  resumePublished,
  publishDraft,
  setProductModeration,
  setUserSuspended,
  setBillingMethod,
  applyListingPayout,
  setPayoutField,
  setAutoConfirm,
  setBillingStarted,
  ensureListingFeeBill,
  claimSellerCheckout,
  rememberCollectionCheckout,
  releaseSellerCheckout,
  setListingAutoRenew,
  stageDigitalPlan,
  stageBuyPlan,
  stageSellerCollection,
  setListingFeeExempt,
  setQuoteFeeExempt,
  recordTwigBill,
  holdAsDraft,
  reactivateProduct,
  replacePasswordReset,
  takePasswordReset,
  toggleFavorite,
  toggleFollow,
  toggleLike,
  toggleGuestLike,
  allocatePublicId,
  uniqueSlug,
  listUsers,
  updatePassword,
  updateUsername,
  updateUserRole,
  userHasTwigs,
  updateMessageStatus,
  markFileSent,
  completePayout,
  setDispute,
  sellerProducts,
  startPayout,
  updateOrderStatus,
  updateProduct,
  updateQuoteStatus,
  saveQuoteOffer,
} from "@/lib/db";
import { formatPickupChoice, pickupChoiceProblem } from "@/lib/pickup";
import {
  appUrl,
  formatMoney,
  fulfillmentOptions,
  cartFulfillmentCharge,
  isPrivateUsername,
  isTwigLive,
  normalizeSrc,
  orderAmount,
  readCta,
  RESERVED_USERNAMES,
  safeNext,
  slugify,
  SRC_COOKIE,
} from "@/lib/format";
import type { Cta, FormState, Fulfillment, OrderStatus, ProductInput } from "@/lib/types";
import { COPYRIGHT_POLICY_VERSION, IP_POLICY_VERSION, LISTING_REPORT_REASONS, PRIVACY_VERSION, REPORT_STATUSES, RIGHT_TYPES, TERMS_VERSION } from "@/lib/legal";
import { digitalContentVersion, digitalRightsDue, enforcementLabel, enforcementNeedsConfirm, enforcementNotice, sellerMayPublish, twigigiFileHeld, type EnforcementAction, ENFORCEMENT_ACTIONS } from "@/lib/copyright";
import { sendOrderEmail, sendResetEmail } from "@/lib/mail";
import { ensureVisitor } from "@/lib/visitor";
import { isBillingMethod, listingFeeCents, listingFeeCurrency, listingStillPaid } from "@/lib/billing";
import { BILLING_CONSENT_VERSION, cardCanRenew } from "@/lib/billing-auth";
import { normalizeQuoteForm } from "@/lib/quote-form";
import { cancelFeeIntent, createBillingSetupSession, createDigitalStripeCheckout, createStripeConnectLink, createStripePayoutLink, getStripe, publicStripeError, retrieveFeeIntent } from "@/lib/stripe";
import { DIGITAL_FILE_CATEGORY, categoryProblem, resolveCategory } from "@/lib/categories";
import { readBuyOffer, resolveSelection } from "@/lib/variants";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function lastText(formData: FormData, key: string) {
  const values = formData.getAll(key).filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return values.at(-1) ?? "";
}

function draftKeyFrom(value: string) {
  const key = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key) ? key : "";
}

function readJson(raw: string) {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function newId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const body = Buffer.from(bytes).toString("base64url");
  return `${prefix}_${body}`;
}

async function trafficSource() {
  const value = (await cookies()).get(SRC_COOKIE)?.value;
  return normalizeSrc(value) || "direct";
}

const signupSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, "Use 3–30 letters, numbers, or hyphens."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});

type OpenedAccount = FormState & { ok?: boolean; userId?: string };

async function startSession(userId: string): Promise<string | null> {
  if (!process.env.AUTH_SECRET) return "Sign-in is not set up yet.";
  try {
    await setSession(userId);
    return null;
  } catch {
    return "Could not sign you in.";
  }
}

function readSignup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    displayName: text(formData, "displayName"),
    username: text(formData, "username"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (text(formData, "password") !== text(formData, "passwordConfirm")) {
    errors.passwordConfirm = "Those passwords do not match.";
  }
  if (!parsed.success || errors.passwordConfirm) return { fieldErrors: errors };
  return { data: parsed.data };
}

async function createSellerAccount(formData: FormData): Promise<OpenedAccount> {
  const parsed = readSignup(formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };
  if (RESERVED_USERNAMES.has(parsed.data.username)) {
    return { fieldErrors: { username: "That username is reserved." } };
  }
  if (isPrivateUsername(parsed.data.username)) {
    return { fieldErrors: { username: "That username is reserved." } };
  }
  if (findUserByUsername(parsed.data.username)) {
    return { fieldErrors: { username: "That username is taken." } };
  }
  const id = newId("usr");
  try {
    createUser({
      id,
      email: parsed.data.email,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
      publicId: allocatePublicId(),
      username: parsed.data.username,
      displayName: parsed.data.displayName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users.email")) return { fieldErrors: { email: "An account with that email already exists." } };
    if (message.includes("users.username")) return { fieldErrors: { username: "That username is taken." } };
    return { error: "Could not create the account." };
  }
  claimBuyerOrders(id, parsed.data.email);
  recordLegalAcceptance(id, "terms", TERMS_VERSION);
  recordLegalAcceptance(id, "privacy", PRIVACY_VERSION);
  const sessionError = await startSession(id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: id };
}

async function createAccount(formData: FormData): Promise<OpenedAccount> {
  const parsed = readSignup(formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };
  if (RESERVED_USERNAMES.has(parsed.data.username) || isPrivateUsername(parsed.data.username)) {
    return { fieldErrors: { username: "That username is reserved." } };
  }
  if (findUserByUsername(parsed.data.username)) {
    return { fieldErrors: { username: "That username is taken." } };
  }
  const id = newId("usr");
  try {
    createUser({
      id,
      email: parsed.data.email,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
      publicId: allocatePublicId(),
      username: parsed.data.username,
      displayName: parsed.data.displayName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users.email")) return { fieldErrors: { email: "An account with that email already exists." } };
    if (message.includes("users.username")) return { fieldErrors: { username: "That username is taken." } };
    return { error: "Could not create the account." };
  }
  claimBuyerOrders(id, parsed.data.email);
  recordLegalAcceptance(id, "terms", TERMS_VERSION);
  recordLegalAcceptance(id, "privacy", PRIVACY_VERSION);
  const sessionError = await startSession(id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: id };
}

function accountHome(userId: string) {
  return userHasTwigs(userId) ? "/dashboard" : "/orders";
}

function claimPublicUsername(userId: string, raw: string): FormState {
  const parsed = signupSchema.shape.username.safeParse(raw);
  if (!parsed.success) return { fieldErrors: { username: "Use 3–30 letters, numbers, or hyphens." } };
  if (RESERVED_USERNAMES.has(parsed.data) || isPrivateUsername(parsed.data)) {
    return { fieldErrors: { username: "That username is reserved." } };
  }
  const taken = findUserByUsername(parsed.data);
  if (taken && taken !== userId) return { fieldErrors: { username: "That username is taken." } };
  try {
    updateUsername(userId, parsed.data);
  } catch {
    return { fieldErrors: { username: "That username is taken." } };
  }
  return {};
}

async function signInAccount(formData: FormData): Promise<OpenedAccount> {
  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return { error: "Email or password is incorrect." };
  }
  if (user.suspended) return { error: "This account is suspended." };
  const sessionError = await startSession(user.id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: user.id };
}

async function openAccount(formData: FormData) {
  if (text(formData, "accountMode") === "login") return signInAccount(formData);
  return createSellerAccount(formData);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const created = await createAccount(formData);
  if (!created.ok) return created;
  const cta = readCta(text(formData, "cta"));
  const requested = text(formData, "next");
  const after = cta ? `/dashboard/products/new?cta=${cta}` : requested ? safeNext(requested) : "/orders";
  return { next: `/billing?next=${encodeURIComponent(after)}` };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const opened = await signInAccount(formData);
  if (!opened.ok || !opened.userId) return opened;
  const user = findUserById(opened.userId);
  if (user) claimBuyerOrders(user.id, user.email);
  const requested = text(formData, "next");
  return { next: requested ? safeNext(requested) : accountHome(opened.userId) };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { fieldErrors: { email: "Enter a valid email." } };
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return { error: "Password reset email is not set up yet." };
  const user = findUserByEmail(email);
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    replacePasswordReset(newId("rst"), user.id, tokenHash, expires);
    try {
      await sendResetEmail(user.email, `${appUrl()}/reset?token=${encodeURIComponent(token)}`);
    } catch {
      return { error: "Could not send the reset email. Try again later." };
    }
  }
  return { saved: true };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  const password = text(formData, "password");
  if (password.length < 8 || password.length > 72) return { fieldErrors: { password: "Use at least 8 characters." } };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const userId = token ? takePasswordReset(tokenHash) : null;
  if (!userId) return { error: "This reset link is invalid or expired." };
  updatePassword(userId, bcrypt.hashSync(password, 10));
  const sessionError = await startSession(userId);
  if (sessionError) return { error: sessionError };
  return { next: accountHome(userId) };
}

export async function signOut() {
  await clearSession();
  redirect("/");
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const DOCUMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const DOCUMENT_EXTENSIONS: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
};

function safeImagePath(value: string) {
  if (!/^\/(uploads|seed)\/[a-zA-Z0-9._-]+$/.test(value)) return null;
  if (value.startsWith("/uploads/")) return resolveUpload(value) ? value : null;
  const relative = value.replace(/^\/+/, "");
  const root = path.join(process.cwd(), "public");
  const full = path.join(root, relative);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.startsWith(rootWithSep) || !fs.existsSync(full)) return null;
  return value;
}

function cleanHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseMoney(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  return Math.round(Number(trimmed) * 100);
}

function parseWhole(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,4}$/.test(trimmed)) return "invalid";
  return Number(trimmed);
}

async function readOrderPersonalization(config: import("@/lib/personalization").PersonalizationConfig, formData: FormData) {
  if (!config.enabled || (config.fields.length < 1 && !config.proof)) return { ok: true as const, snapshot: null, images: [] as string[] };
  const values: Record<string, string> = {};
  const saved: Record<string, { path: string; name: string }[]> = {};
  for (const field of config.fields) {
    if (field.kind !== "file") {
      values[field.id] = text(formData, `p_${field.id}`);
      continue;
    }
    const files = formData.getAll(`pFile_${field.id}`).filter((item): item is File => item instanceof File && item.size > 0).slice(0, PERSONALIZATION_FILE_LIMIT);
    if (files.length > field.maxFiles) return { ok: false as const, errors: { [field.id]: `Add up to ${field.maxFiles} ${field.maxFiles === 1 ? "file" : "files"}.` } };
    try {
      const paths = files.length > 0 ? await saveImages(files) : [];
      saved[field.id] = paths.map((filePath, index) => ({ path: filePath, name: files[index].name.split(/[/\\]/).pop()?.slice(0, 80) || "file" }));
    } catch (error) {
      return { ok: false as const, errors: { [field.id]: error instanceof Error ? error.message : "Use JPG, PNG, or WebP photos under 5 MB." } };
    }
  }
  const answers = answerFromBuyer(config, values, saved);
  if (!answers.ok) return { ok: false as const, errors: answers.errors };
  return { ok: true as const, snapshot: emptySnapshot(config, answers.answers), images: answers.answers.flatMap((answer) => answer.files.map((file) => file.path)) };
}

async function saveImages(files: File[]) {
  const directory = uploadDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const paths: string[] = [];
  for (const file of files) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) throw new Error("Use JPG, PNG, or WebP photos.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Each photo must be under 5 MB.");
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    paths.push(`/uploads/${filename}`);
  }
  return paths;
}

function documentExtension(file: File) {
  const fromType = DOCUMENT_TYPES[file.type];
  if (fromType) return fromType;
  if (file.type && file.type !== "application/octet-stream") return "";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_EXTENSIONS[ext] ?? "";
}

async function saveQuoteDocuments(files: File[]) {
  const directory = uploadDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const saved: { path: string; name: string }[] = [];
  for (const file of files) {
    const ext = documentExtension(file);
    if (!ext) throw new Error("Use PNG, JPG, Word, or PDF files.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Each file must be under 5 MB.");
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    const name = file.name.split(/[/\\]/).pop()?.replace(/[^\w.\- ()]/g, "").slice(0, 80) || `file.${ext}`;
    saved.push({ path: `/uploads/${filename}`, name });
  }
  return saved;
}

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = lastText(formData, "id");
  const draftKey = draftKeyFrom(lastText(formData, "draftKey"));
  let existing = id ? getProductById(id) : null;

  const intent = text(formData, "intent") === "publish" ? "publish" : "draft";
  const errors: Record<string, string> = {};
  const title = text(formData, "title").trim();
  const description = storedDescription(text(formData, "description"));
  const descriptionLength = descriptionPlain(description).length;
  const location = text(formData, "location").trim();
  const ctaValue = text(formData, "cta");
  const cta: Cta = ctaValue === "buy" || ctaValue === "contact" || ctaValue === "file" ? ctaValue : "quote";
  const connectStripe = text(formData, "connectStripe") === "1" && cta === "file";
  const priced = cta === "buy" || cta === "file";
  const price = parseMoney(text(formData, "price"));
  const deliveryRadius = parseWhole(text(formData, "deliveryRadiusKm"));
  const deliveryFee = parseMoney(text(formData, "deliveryFee"));
  const shippingFee = parseMoney(text(formData, "shippingFee"));
  const freeShippingOver = parseMoney(text(formData, "freeShippingOver"));
  const videoRaw = text(formData, "videoUrl").trim();
  const videoUrl = videoRaw ? cleanHttpUrl(videoRaw) : null;

  if (title.length < 2) errors.title = "Enter a product name.";
  if (title.length > 80) errors.title = "Keep the name under 80 characters.";
  const allowService = cta === "buy" || cta === "quote";
  const categoryKindInput = text(formData, "categoryKind");
  const chosenCategory =
    cta === "file"
      ? DIGITAL_FILE_CATEGORY
      : cta === "contact"
        ? null
        : resolveCategory(categoryKindInput, text(formData, "categoryGroup"), text(formData, "category"), allowService);
  if (cta !== "contact" && cta !== "file" && !chosenCategory) {
    errors.category = categoryProblem(categoryKindInput, text(formData, "categoryGroup"), text(formData, "category"), allowService) ?? "Choose a category.";
  }
  if (descriptionLength > 2000) {
    errors.description = `Keep the description under 2,000 characters (${descriptionLength.toLocaleString("en-US")} so far).`;
  } else if (descriptionLength < 10) {
    const remaining = 10 - descriptionLength;
    errors.description =
      remaining === 10
        ? "Add a short description of at least 10 characters."
        : `Add ${remaining} more character${remaining === 1 ? "" : "s"} (at least 10).`;
  }
  if (price === "invalid") errors.price = "Enter a price like 128 or 128.50.";
  if (deliveryRadius === "invalid") errors.deliveryRadiusKm = "Enter a radius in kilometres.";
  if (deliveryFee === "invalid") errors.deliveryFee = "Enter a delivery fee like 18 or 0.";
  if (shippingFee === "invalid") errors.shippingFee = "Enter a shipping fee like 20 or leave it blank.";
  if (videoRaw && !videoUrl) errors.videoUrl = "Enter a full http(s) video link.";

  const kept = formData
    .getAll("kept")
    .filter((item): item is string => typeof item === "string")
    .map(safeImagePath)
    .filter((item): item is string => Boolean(item));
  const slots = formData.getAll("photoSlot").filter((item): item is string => typeof item === "string" && item.length > 0);
  const files = formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (slots.length > 6) errors.images = "Use up to 6 photos.";
  if (slots.length > 0 && slots.filter((slot) => slot === "file").length !== files.length) errors.images = "Could not save the photos.";
  if (kept.length + files.length > 6) errors.images = "Use up to 6 photos.";
  for (const file of files) {
    if (!IMAGE_TYPES[file.type]) errors.images = "Use JPG, PNG, or WebP photos.";
    if (file.size > 5 * 1024 * 1024) errors.images = "Each photo must be under 5 MB.";
  }

  const pickupEnabled = formData.get("pickupEnabled") === "on";
  const deliveryEnabled = formData.get("deliveryEnabled") === "on";
  const shippingEnabled = formData.get("shippingEnabled") === "on";
  if (shippingEnabled && (freeShippingOver === "invalid" || freeShippingOver === 0)) {
    errors.freeShippingOver = "Enter an amount like 50, or leave it blank.";
  }
  const onsiteEnabled = formData.get("onsiteEnabled") === "on";
  const remoteEnabled = formData.get("remoteEnabled") === "on";
  const atLocationEnabled = formData.get("atLocationEnabled") === "on";
  const contactEmail = text(formData, "contactEmail").trim().toLowerCase();
  const contactPhone = text(formData, "contactPhone").trim();

  const buttonLabel = text(formData, "buttonLabel").trim().slice(0, 40) || "Buy now";
  const quantityMode = text(formData, "quantityMode");
  const quantityRaw = parseWhole(text(formData, "quantityAvailable"));
  let quantityAvailable: number | null = null;
  if (priced && quantityMode === "limited") {
    if (quantityRaw === "invalid" || quantityRaw == null) errors.quantityAvailable = "Enter how many you can sell, or choose Unlimited.";
    else quantityAvailable = quantityRaw;
  }
  const offer =
    cta === "buy"
      ? readBuyOffer({
          hasOptions: formData.get("hasOptions") === "1",
          samePrice: formData.get("samePrice") !== "0",
          optionsJson: text(formData, "optionsJson"),
          variantsJson: text(formData, "variantsJson"),
          priceCents: typeof price === "number" ? price : null,
          publishing: intent === "publish",
        })
      : { hasOptions: false, samePrice: true, options: [], variants: [], errors: {} as Record<string, string> };
  Object.assign(errors, offer.errors);
  if (buttonLabel.length > 40) errors.buttonLabel = "Keep the button text under 40 characters.";

  if (priced && price !== "invalid" && (typeof price !== "number" || price < 50)) {
    errors.price = "Enter a price of at least $0.50.";
  }
  if (cta === "buy") {
    const place = placeProblem(location);
    if (place) errors.location = place;
  }
  const payCountry = splitLocation(cta === "file" ? "" : location).country;
  let paymentMethods = cta === "file" ? [] : priced ? parsePaymentMethods(text(formData, "paymentMethods"), payCountry) : [];
  if (cta === "buy" && !pickupEnabled) paymentMethods = paymentMethods.filter((id) => !isCashMethod(id));
  let cardPaymentUrl = text(formData, "cardPaymentUrl").trim().slice(0, 500);
  const interacEmail = text(formData, "interacEmail").trim().slice(0, 80);
  const interacQuestion = text(formData, "interacQuestion").trim().slice(0, 120);
  const interacPassword = text(formData, "interacPassword").trim().slice(0, 80);
  const venmoRaw = text(formData, "venmoUsername").trim().slice(0, 200);
  const venmoName = venmoUsernameFrom(venmoRaw);
  const venmoUsername = venmoName || venmoRaw.replace(/^@/, "").slice(0, 30);
  const paypalRaw = (cta === "file" ? text(formData, "paypalMe") || cardPaymentUrl : text(formData, "paypalMe")).trim().slice(0, 200);
  const paypalName = paypalMeName(paypalRaw);
  let paypalMe = paypalName ? `https://paypal.me/${paypalName}` : paypalRaw;
  if (cta === "file") cardPaymentUrl = "";
  const sellerContactMode = text(formData, "sellerContactMode") === "phone" ? "phone" : "email";
  const sellerContact = text(formData, "sellerContact").trim().slice(0, 80);
  if (priced && intent === "publish") {
    if (cta !== "file" && paymentMethods.length === 0) {
      errors.paymentMethods = payCountry ? "Choose at least one way buyers can pay." : "Choose a country before choosing how buyers pay.";
    }
    if (cta === "file") {
      const rawPaypal = text(formData, "paypalEmail").trim();
      if (rawPaypal && !safeEmail(rawPaypal)) errors.paypalEmail = "Enter a PayPal email like name@email.com.";
    } else if (paymentMethods.includes("card")) {
      const problem = cardLinkProblem(cardPaymentUrl);
      if (problem) errors.cardPaymentUrl = problem;
    }
    if (paymentMethods.includes("interac")) {
      const problem = interacEmailProblem(interacEmail);
      if (problem) errors.interacEmail = problem;
    }
    if (paymentMethods.includes("venmo")) {
      const problem = venmoUsernameProblem(venmoRaw);
      if (problem) errors.venmoUsername = problem;
    }
    if (cta !== "file" && paymentMethods.includes("paypal")) {
      const problem = paypalMeProblem(paypalRaw);
      if (problem) errors.paypalMe = problem;
    }
    if ((shippingEnabled || deliveryEnabled) && !paymentMethods.some((id) => isTransferMethod(id))) {
      errors.paymentMethods = "Add a transfer method for delivery and shipping, such as Interac, PayPal, or Venmo.";
    }
    const contactProblem = sellerContactProblem(sellerContactMode, sellerContact);
    if (contactProblem) errors.sellerContact = contactProblem;
  }

  const parsedLinks = cta === "file" ? parseFileLinks(text(formData, "fileLinksJson")) : { links: [] as string[], error: null };
  const filePassword = cta === "file" ? text(formData, "filePassword").trim().slice(0, 80) : "";
  if (intent === "publish") {
    if (!priced && location.length < 2) errors.location = "Add a public location, such as a city.";
    if (kept.length + files.length < 1) errors.images = "Add at least one photo.";
    if (cta === "file" && parsedLinks.error) errors.fileLinks = parsedLinks.error;
    if (cta === "buy" && pickupEnabled && text(formData, "pickupNote").trim().length < 2) {
      errors.pickupNote = "Add the pickup address.";
    }
    if (cta === "buy" && shippingEnabled && text(formData, "shippingNote").trim().length < 2) {
      errors.shippingNote = "Enter the delivery area.";
    }
    if (cta === "quote" && !pickupEnabled && !deliveryEnabled && !shippingEnabled && !onsiteEnabled && !remoteEnabled && !atLocationEnabled) {
      errors.fulfillment = "Choose how you will provide it.";
    }
    if (cta === "buy" && !pickupEnabled && !shippingEnabled) {
      errors.fulfillment = "Choose pickup, delivery, or shipping.";
    }
    if (!z.string().email().safeParse(contactEmail).success) {
      errors.contactEmail = cta === "quote" ? "Enter a contact email." : "Enter an email for buyer replies.";
    }
    if (cta !== "file" && text(formData, "contentRights") !== "yes") {
      errors.contentRights = "Confirm that you own or have permission to use the content in this listing.";
    }
  }
  const fileRightsMoment = cta === "file" && (intent === "publish" || existing?.status === "published");
  if (fileRightsMoment && digitalRightsDue({
    confirmed: Boolean(existing?.rightsConfirmed),
    confirmedVersion: existing?.rightsContentVersion ?? "",
    confirmedPolicy: existing?.rightsIpVersion ?? "",
    fileLinks: parsedLinks.links,
    images: kept,
    imagesChanged: files.length > 0,
  }) && text(formData, "digitalRights") !== "yes") {
    errors.digitalRights = "Confirm that you own this content or have permission to sell and distribute it.";
  }

  const personalizationRaw = text(formData, "personalizationJson");
  let personalization = emptyPersonalization();
  if (cta === "buy" && personalizationRaw) {
    const parsed = personalizationFromSeller(personalizationRaw);
    if (!parsed.ok) errors.personalization = parsed.error;
    else personalization = parsed.config;
  } else if (cta === "buy" && text(formData, "customProduct") === "1" && formData.get("buyerUpload") === "1") {
    personalization = legacyUploadPersonalization();
  }

  if (cta === "quote" && text(formData, "profileSkipped") !== "1") {
    const logo = formData.get("businessLogo");
    if (logo instanceof File && logo.size > 0) {
      if (!IMAGE_TYPES[logo.type]) errors.businessLogo = "Use JPG, PNG, or WebP photos.";
      else if (logo.size > 5 * 1024 * 1024) errors.businessLogo = "Each photo must be under 5 MB.";
    }
    const caseFiles = formData.getAll("caseImages").filter((item): item is File => item instanceof File && item.size > 0);
    if (formData.getAll("caseKept").length + caseFiles.length > 4) errors.caseImages = "Use up to 4 photos.";
    for (const file of caseFiles) {
      if (!IMAGE_TYPES[file.type]) errors.caseImages = "Use JPG, PNG, or WebP photos.";
      else if (file.size > 5 * 1024 * 1024) errors.caseImages = "Each photo must be under 5 MB.";
    }
  }

  if (connectStripe) {
    for (const key of Object.keys(errors)) {
      if (key !== "images") delete errors[key];
    }
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const savedTitle = connectStripe && (title.length < 2 || title.length > 80) ? existing?.title || "Untitled" : title;
  const savedDescription = connectStripe && descriptionLength > 2000 ? existing?.description || "" : description;
  const savedPrice = connectStripe && (typeof price !== "number" || price < 50) ? existing?.priceCents ?? null : price;

  let user = await getCurrentUser();
  let sessionStamp: FormState = {};
  if (!user) {
    const opened = await openAccount(formData);
    if (!opened.ok || !opened.userId) return opened;
    user = findUserById(opened.userId);
    if (!user) return { error: "Could not open the account." };
    sessionStamp = { signedIn: true, displayName: user.displayName };
  }
  const acting = await getImpersonation();
  const adminEdit = Boolean(existing && user.role === "admin" && existing.userId !== user.id);
  const owner = adminEdit && existing ? findUserById(existing.userId) : user;
  if (!owner || (id && (!existing || existing.userId !== owner.id))) {
    return { error: "That Twig was not found.", ...sessionStamp };
  }
  if (!existing && draftKey) {
    const keyed = getDraftByKey(owner.id, draftKey);
    if (keyed) existing = keyed;
  }
  if (!existing && intent === "draft" && title.length >= 2) {
    const recent = getRecentDraftByTitle(owner.id, cta, title);
    if (recent) existing = recent;
  }
  if ((owner.suspended || owner.banned) && !acting && !adminEdit) return { error: "This account cannot publish.", ...sessionStamp };
  if (intent === "publish" && !sellerMayPublish(owner) && !acting && !adminEdit) return { error: "Publishing is restricted on this account.", ...sessionStamp };
  if (cta === "file") {
    const filePaypal = safeEmail(text(formData, "paypalEmail"));
    paymentMethods = digitalPayMethods({ paypalEmail: filePaypal, stripeReady: owner.stripeChargesEnabled });
    if (intent === "publish" && paymentMethods.length === 0) {
      return { fieldErrors: { paypalEmail: "Add a PayPal email or connect Stripe in Payment settings." }, ...sessionStamp };
    }
  }
  if (existing && existing.status !== "draft" && intent === "draft" && !connectStripe) {
    return {
      error:
        existing.status === "published"
          ? "A live Twig cannot be saved as a draft. Deactivate it from the dashboard. It stays live until the next billing date, then it is permanently deleted 30 days after it deactivates if you do not reactivate."
          : "A deactivated Twig cannot be saved as a draft. Reactivate it from the dashboard, or it is permanently deleted 30 days after it was deactivated.",
      ...sessionStamp,
    };
  }

  let images = kept;
  try {
    const saved = await saveImages(files);
    if (slots.length > 0) {
      let fileAt = 0;
      images = [];
      for (const slot of slots) {
        if (slot === "file") {
          const next = saved[fileAt];
          fileAt += 1;
          if (next) images.push(next);
        } else {
          const safe = safeImagePath(slot);
          if (safe) images.push(safe);
        }
      }
    } else {
      images = [...kept, ...saved];
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the photos.", ...sessionStamp };
  }

  const requestedSlug = slugify(text(formData, "slug") || savedTitle);
  const slug = uniqueSlug(owner.id, requestedSlug, existing?.id);
  const input: ProductInput = {
    slug,
    title: savedTitle,
    brand: cta === "contact" ? "" : text(formData, "brand").trim().slice(0, 80),
    categoryKind: chosenCategory?.kind === "service" ? "service" : chosenCategory ? "product" : "",
    categoryGroup: chosenCategory?.groupId ?? "",
    category: chosenCategory?.itemId ?? "",
    description: savedDescription,
    priceCents: typeof savedPrice === "number" ? savedPrice : null,
    location: cta === "file" ? "" : location,
    videoUrl,
    pickupEnabled,
    pickupNote: text(formData, "pickupNote").trim().slice(0, 400),
    pickupTime: text(formData, "pickupTime").trim().slice(0, 480),
    deliveryEnabled,
    deliveryRadiusKm: deliveryEnabled && typeof deliveryRadius === "number" ? deliveryRadius : null,
    deliveryFeeCents: deliveryEnabled && typeof deliveryFee === "number" ? deliveryFee : null,
    shippingEnabled,
    shippingFeeCents: shippingEnabled && typeof shippingFee === "number" ? shippingFee : null,
    freeShippingOverCents: shippingEnabled && typeof freeShippingOver === "number" ? freeShippingOver : null,
    shippingNote: text(formData, "shippingNote").trim().slice(0, 400),
    onsiteEnabled,
    remoteEnabled,
    atLocationEnabled,
    cta,
    contactEmail,
    contactPhone: contactPhone.slice(0, 40),
    status: connectStripe && existing && existing.status !== "draft" ? existing.status : intent === "publish" ? "published" : "draft",
    images,
    quantityAvailable: priced ? quantityAvailable : null,
    buttonLabel: cta === "file" ? "Get the file" : cta === "buy" ? buttonLabel : "Buy now",
    hasOptions: cta === "buy" && offer.hasOptions,
    samePrice: cta === "buy" ? offer.samePrice : true,
    options: cta === "buy" ? offer.options : [],
    variants: cta === "buy" && offer.hasOptions ? offer.variants : [],
    requireName: !priced || formData.get("requireName") === "on",
    requireEmail: true,
    requirePhone: !priced || formData.get("requirePhone") === "on",
    quoteForm: cta === "quote" ? normalizeQuoteForm(readJson(text(formData, "quoteFormJson"))) : null,
    paymentMethods,
    cardPaymentUrl,
    interacEmail,
    interacQuestion: paymentMethods.includes("interac") ? interacQuestion : "",
    interacPassword: paymentMethods.includes("interac") ? interacPassword : "",
    venmoUsername,
    paypalMe: cta === "file" ? "" : paymentMethods.includes("paypal") ? paypalMe : "",
    paypalEmail: cta === "file" ? safeEmail(text(formData, "paypalEmail")) : "",
    customProduct: cta === "buy" && personalization.enabled,
    buyerUpload: cta === "buy" && personalization.enabled && personalization.fields.some((field) => field.kind === "file"),
    personalization,
    zelleMode: "phone",
    zelleContact: "",
    sellerContactMode: priced ? sellerContactMode : "email",
    sellerContact: priced ? sellerContact : "",
    fileLinks: parsedLinks.links,
    filePassword,
  };

  let savedProductId = existing?.id ?? newId("prd");
  const publishingNewFile = cta === "file" && intent === "publish" && existing?.status !== "published";
  const publishingNewBuy = cta === "buy" && intent === "publish" && existing?.status !== "published";
  const needsBilling = intent === "publish" && !publishingNewFile && !publishingNewBuy && !adminEdit && !acting && !existing?.feeExempt && !user.billingMethod;
  if (needsBilling) input.status = "draft";
  if (publishingNewFile || publishingNewBuy) input.status = existing?.status === "deactivated" ? "deactivated" : "draft";
  try {
    if (existing) {
      updateProduct(existing.id, owner.id, input);
      if (draftKey) claimDraftKey(existing.id, owner.id, draftKey, "keep");
      if (input.status !== "published" || existing.status === "deactivated") clearDeactivatesAt(existing.id, owner.id);
      if (input.status === "published" && existing.status === "deactivated") clearDeactivatedAt(existing.id, owner.id);
    } else {
      insertProduct(savedProductId, owner.id, input);
      if (draftKey) {
        const claimed = claimDraftKey(savedProductId, owner.id, draftKey, "drop-new");
        if (claimed !== savedProductId) {
          updateProduct(claimed, owner.id, input);
          savedProductId = claimed;
          existing = getProductById(claimed);
        }
      }
    }
    if (input.status === "published" && cta === "file" && text(formData, "digitalRights") === "yes") {
      confirmDigitalRights(savedProductId, owner.id, TERMS_VERSION, COPYRIGHT_POLICY_VERSION, digitalContentVersion(parsedLinks.links, images));
    } else if (input.status === "published" && cta !== "file") {
      confirmListingRights(savedProductId, owner.id, TERMS_VERSION, IP_POLICY_VERSION);
    }
  } catch (error) {
    console.error("saveProduct failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE/i.test(message)) return { error: "Could not save this Twig. Try a different link name.", ...sessionStamp };
    return { error: "Could not save this Twig.", ...sessionStamp };
  }

  if (existing && existing.paypalMe !== input.paypalMe) {
    recordPaymentLinkChange(newId("ple"), {
      productId: existing.id,
      userId: owner.id,
      kind: "paypal",
      previous: existing.paypalMe,
      next: input.paypalMe,
    });
  }
  if (existing && existing.venmoUsername !== input.venmoUsername) {
    recordPaymentLinkChange(newId("ple"), {
      productId: existing.id,
      userId: owner.id,
      kind: "venmo",
      previous: existing.venmoUsername,
      next: input.venmoUsername,
    });
  }

  if (existing && existing.slug !== slug) updateTag(productTag(owner.publicId, existing.slug));
  updateTag(productTag(owner.publicId, slug));
  updateTag(sellerTag(owner.publicId));
  if (cta === "quote") {
    const skipped = text(formData, "profileSkipped") === "1";
    let businessLogo = "";
    const caseImages = formData.getAll("caseKept").filter((item): item is string => typeof item === "string").map(safeImagePath).filter((item): item is string => Boolean(item));
    if (!skipped) {
      const logo = formData.get("businessLogo");
      if (logo instanceof File && logo.size > 0) {
        const saved = await saveImages([logo]);
        businessLogo = saved[0] || "";
      } else {
        businessLogo = safeImagePath(text(formData, "businessLogoKept")) || "";
      }
      const caseFiles = formData.getAll("caseImages").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 4);
      if (caseFiles.length > 0) caseImages.push(...await saveImages(caseFiles));
    }
    writeQuoteTwigSettings({
      productId: savedProductId,
      businessName: text(formData, "businessName").trim().slice(0, 80),
      businessBio: text(formData, "businessBio").trim().slice(0, 400),
      businessLogo,
      caseImages: caseImages.slice(0, 4),
      profileSkipped: skipped,
      visitEnabled: formData.get("visitEnabled") === "on",
      offerEnabled: formData.get("offerEnabled") === "on",
      invoiceEnabled: formData.get("invoiceEnabled") === "on",
    });
  }

  if (connectStripe) {
    const back = `/dashboard/products/${savedProductId}`;
    const country = text(formData, "stripeCountry") === "US" ? "US" : stripeConnectCountry(owner);
    const kept = { productId: savedProductId, slug, ...sessionStamp };
    try {
      const linked = await createStripeConnectLink({
        accountId: owner.stripeAccountId,
        email: owner.email,
        country,
        returnPath: back,
      });
      if (!linked) return { error: "Stripe is not set up on this server yet.", ...kept };
      if (linked.accountId) setStripeAccount(owner.id, linked.accountId, owner.stripeChargesEnabled);
      if (!linked.url) return { error: linked.message || "Stripe could not open the connection page. Try again in a moment.", ...kept };
      return { stripeUrl: linked.url, ...kept };
    } catch (error) {
      unstable_rethrow(error);
      return { error: "Stripe could not open the connection page. Try again in a moment.", ...kept };
    }
  }

  if (needsBilling) redirect(`/billing?next=${encodeURIComponent(`/dashboard/products/${savedProductId}`)}`);
  if (publishingNewFile) {
    const claimed = claimDigitalFilePublish(savedProductId, owner.id);
    if (!claimed.ok) return { error: digitalPublishMessage(claimed), ...sessionStamp };
    redirect(`/${owner.publicId}/${slug}`);
  }
  if (publishingNewBuy) {
    const claimed = claimBuyNowPublish(savedProductId, owner.id);
    if (!claimed.ok) redirect(`/dashboard/buy?draft=${encodeURIComponent(savedProductId)}&notice=${claimed.reason}`);
    redirect(`/${owner.publicId}/${slug}`);
  }
  if (input.status === "published" && (!existing || existing.status !== "published")) {
    const cents = listingFeeCents(input.cta, Boolean(existing?.feeExempt));
    const cardReady = (user.billingMethod === "card" || user.billingMethod === "stripe") && Boolean(getStripe());
    const paypalReady = user.billingMethod === "paypal" && paypalConfigured();
    if (cents > 0 && !acting && !existing?.feeExempt) {
      holdAsDraft(savedProductId, owner.id);
      const draft = getProductById(savedProductId);
      if (draft && (cardReady || paypalReady)) await redirectListingFee(user, draft);
      redirect(`/dashboard/products/${savedProductId}?saved=1`);
    }
  }
  if (input.status === "published") redirect(`/${owner.publicId}/${slug}`);
  if (existing?.status === "published") redirect(`/dashboard/products/${savedProductId}?saved=1`);
  const requestedStep = text(formData, "editorStep");
  const editorStep = requestedStep === "2" || requestedStep === "3" || requestedStep === "4" ? requestedStep : "1";
  redirect(`/dashboard/products/${savedProductId}?saved=1&step=${editorStep}`);
}

function dropProduct(user: { id: string; publicId: string }, product: { id: string; userId: string; status: string; slug: string }) {
  if (product.userId !== user.id) return;
  if (product.status === "published") return;
  if (product.status === "draft" && productHasActivity(product.id)) return;
  if (product.status !== "draft" && product.status !== "deactivated") return;
  if (!deleteProduct(product.id, user.id)) return;
  updateTag(productTag(user.publicId, product.slug));
}

export async function removeProduct(formData: FormData) {
  const user = await requireSeller();
  const id = text(formData, "id");
  const product = getProductById(id);
  if (!product || product.userId !== user.id) redirect("/dashboard");
  if (product.status === "published") redirect(`/dashboard/products/${product.id}?blocked=live`);
  if (product.status === "draft" && productHasActivity(product.id)) {
    redirect(`/dashboard/products/${product.id}?blocked=1`);
  }
  dropProduct(user, product);
  updateTag(sellerTag(user.publicId));
  redirect("/dashboard");
}

export async function removeProducts(formData: FormData) {
  const user = await requireSeller();
  for (const id of formData.getAll("id")) {
    if (typeof id !== "string") continue;
    const product = getProductById(id);
    if (product) dropProduct(user, product);
  }
  updateTag(sellerTag(user.publicId));
  redirect("/dashboard");
}

export async function deactivateProducts(formData: FormData) {
  const user = await requireSeller();
  for (const id of formData.getAll("id")) {
    if (typeof id !== "string") continue;
    const product = getProductById(id);
    if (!product || product.userId !== user.id || product.status !== "published") continue;
    deactivateNow(product.id, user.id);
    updateTag(productTag(user.publicId, product.slug));
  }
  updateTag(sellerTag(user.publicId));
  redirect("/dashboard");
}

function rememberListingPayout(user: { publicId: string }, slugs: string[]) {
  for (const slug of slugs) updateTag(productTag(user.publicId, slug));
  updateTag(sellerTag(user.publicId));
}

export async function savePayoutDetails(formData: FormData) {
  const user = await requireSeller();
  const clip = (key: string, max: number) => text(formData, key).trim().slice(0, max);
  const which = text(formData, "which");
  const apply = text(formData, "intent") === "apply" && which !== "zelle";

  if (which === "interac") {
    const raw = clip("interac", 120);
    if (raw && interacEmailProblem(raw)) redirect("/dashboard/payments?saved=interac-invalid");
    const stored = raw ? safeEmail(raw) : "";
    setPayoutField(user.id, "interac", stored);
    if (apply) rememberListingPayout(user, applyListingPayout(user.id, "interac", stored));
    redirect(`/dashboard/payments?saved=${apply ? "interac" : "interac-setting"}`);
  }
  if (which === "venmo") {
    const raw = clip("venmo", 80);
    if (raw && venmoUsernameProblem(raw)) redirect("/dashboard/payments?saved=venmo-invalid");
    const stored = raw ? venmoUsernameFrom(raw) : "";
    setPayoutField(user.id, "venmo", stored);
    if (apply) rememberListingPayout(user, applyListingPayout(user.id, "venmo", stored));
    redirect(`/dashboard/payments?saved=${apply ? "venmo" : "venmo-setting"}`);
  }
  if (which === "paypal") {
    const raw = clip("paypal", 200);
    if (raw && paypalMeProblem(raw)) redirect("/dashboard/payments?saved=paypal-invalid");
    const name = paypalMeName(raw);
    const stored = name ? `https://paypal.me/${name}` : "";
    setPayoutField(user.id, "paypal", stored);
    if (apply) rememberListingPayout(user, applyListingPayout(user.id, "paypal", stored));
    redirect(`/dashboard/payments?saved=${apply ? "paypal" : "paypal-setting"}`);
  }
  if (which === "paypal-file") {
    const raw = clip("paypalEmail", 120);
    if (raw && !safeEmail(raw)) redirect("/dashboard/payments?saved=paypal-file-invalid");
    const stored = safeEmail(raw);
    setPayoutField(user.id, "paypalEmail", stored);
    if (apply) rememberListingPayout(user, applyListingPayout(user.id, "paypal-file", stored));
    redirect(`/dashboard/payments?saved=${apply ? "paypal-file" : "paypal-file-setting"}`);
  }
  if (which === "zelle") {
    setPayoutField(user.id, "zelle", clip("zelle", 120));
    redirect("/dashboard/payments?saved=zelle");
  }
  redirect("/dashboard/payments");
}

export async function saveBillingMethod(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireSeller();
  const method = text(formData, "method");
  const next = safeNext(text(formData, "next"));
  if (method !== "card" && method !== "paypal") return { error: "Choose a way to pay Twigigi fees." };
  if (method === "paypal" && !paypalConfigured()) return { error: "PayPal cannot pay Twigigi fees yet." };
  try {
    if (setBillingMethod(user.id, method) < 1) return { error: "The preference was not saved. Your selection is still here." };
  } catch {
    return { error: "The preference was not saved. Your selection is still here." };
  }
  redirect(next);
}

function checkoutReturn(path: string, notice: string) {
  const safe = safeNext(path);
  if (safe === "/dashboard") return "";
  const [base, query = ""] = safe.split("?");
  const params = new URLSearchParams(query);
  if (notice) params.set("notice", notice);
  const next = `${base}?${params.toString()}`;
  return next.startsWith("/dashboard/buy?draft=") ? next : "";
}

async function redirectCollectionCheckout(
  user: { id: string; billingMethod: string; stripeCustomerId?: string },
  staged: { collectionId: string; amountCents: number; currency: string; checkoutUrl: string; idempotencyKey?: string } | null,
  returnPath = "",
) {
  if (!staged || staged.amountCents < 1) return;
  const feeName = staged.idempotencyKey?.startsWith("digital-plan-")
    ? "Twigigi Digital File plan"
    : staged.idempotencyKey?.startsWith("buy-now-plan-")
      ? "Twigigi Buy Now bundle"
      : "Twigigi fees";
  if (staged.checkoutUrl) redirect(staged.checkoutUrl);
  if (!claimSellerCheckout(staged.collectionId, user.id)) redirect("/dashboard/payments?tab=receipts&billing=error");
  try {
  if (user.billingMethod === "paypal") {
    if (!paypalConfigured()) redirect("/dashboard/payments?tab=receipts&billing=paypal&reason=PayPal%20is%20not%20set%20up%20on%20this%20server%20yet.");
    const checkout = await createPlatformFeeCheckout({
      reference: `collection:${staged.collectionId}`,
      amountCents: staged.amountCents,
      currency: staged.currency,
      description: feeName,
      returnPath: checkoutReturn(returnPath, "returned"),
      cancelPath: checkoutReturn(returnPath, "canceled"),
    });
    rememberCollectionCheckout({ collectionId: staged.collectionId, userId: user.id, provider: "paypal", orderId: checkout.orderId, url: checkout.url });
    redirect(checkout.url);
  }
  const stripe = getStripe();
  if (!stripe) {
    releaseSellerCheckout(staged.collectionId, user.id);
    return;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: user.stripeCustomerId || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: staged.currency === "USD" ? "usd" : "cad",
          unit_amount: staged.amountCents,
          product_data: { name: feeName },
        },
      },
    ],
    success_url: `${appUrl()}/billing/complete?session_id={CHECKOUT_SESSION_ID}${checkoutReturn(returnPath, "returned") ? `&next=${encodeURIComponent(checkoutReturn(returnPath, "returned"))}` : ""}`,
    cancel_url: checkoutReturn(returnPath, "canceled") ? `${appUrl()}${checkoutReturn(returnPath, "canceled")}` : `${appUrl()}/dashboard/payments?tab=receipts&billing=canceled`,
    metadata: { purpose: "twigigi_fees", userId: user.id, collectionId: staged.collectionId },
    payment_intent_data: {
      metadata: { purpose: "twigigi_fees", userId: user.id, collectionId: staged.collectionId },
    },
  }, staged.idempotencyKey ? { idempotencyKey: staged.idempotencyKey } : undefined);
  if (!session.url) {
    releaseSellerCheckout(staged.collectionId, user.id);
    return;
  }
  rememberCollectionCheckout({ collectionId: staged.collectionId, userId: user.id, provider: "stripe", orderId: session.id, url: session.url });
  redirect(session.url);
  } catch (error) {
    releaseSellerCheckout(staged.collectionId, user.id);
    throw error;
  }
}

async function redirectListingFee(
  user: { id: string; billingMethod: string; stripeCustomerId?: string },
  product: { id: string; title: string; cta: string; location: string; feeExempt?: boolean; paidUntil?: string | null; billingStatus?: string; graceUntil?: string | null; autoRenew?: boolean; billingAnchorDay?: number },
  returnPath = "",
) {
  const quoteRate = product.cta === "quote" ? readQuoteListingCharge(product.id) : null;
  const cents = quoteRate ? quoteRate.cents : listingFeeCents(product.cta, Boolean(product.feeExempt));
  const currency = quoteRate ? quoteRate.currency : listingFeeCurrency(product.cta, product.location);
  if (cents < 1) return;
  const now = new Date().toISOString();
  const repeat = product.billingAnchorDay === 15 || product.billingAnchorDay === 28;
  const next = repeat ? nextPeriodBill({ paidUntil: product.paidUntil || now }) : null;
  const coverage = repeat ? null : firstCoverage(now);
  const periodKey = next?.periodKey || `first:${product.id}`;
  const periodEnd = next?.periodEnd || coverage?.periodEnd || "";
  const dueAt = next?.dueAt || now;
  const bill = ensureListingFeeBill({
    id: newId("bill"),
    userId: user.id,
    productId: product.id,
    amountCents: cents,
    currency,
    periodKey,
    periodEnd,
    dueAt,
  });
  if (bill.status === "paid") return;
  await redirectCollectionCheckout(user, stageSellerCollection(user.id, currency), returnPath);
}

export async function confirmDigitalPlan(formData: FormData) {
  const user = await requireSeller();
  const planId = text(formData, "plan");
  const copies = Number(text(formData, "copies") || "1");
  const safeCopies = Number.isInteger(copies) ? copies : 0;
  const back = `/dashboard/digital?plan=${encodeURIComponent(planId)}&copies=${encodeURIComponent(String(safeCopies || 1))}`;
  const result = commitDigitalPlan({ id: newId("bill"), userId: user.id, planId, copies: safeCopies });
  if (!result.ok) redirect(`${back}&notice=${result.reason}`);
  if (result.kind !== "bill" || result.chargeCents < 1) redirect("/dashboard/digital?notice=saved");
  if (!user.billingMethod) redirect(`/billing?next=${encodeURIComponent(back)}`);
  try {
    await redirectCollectionCheckout(user, stageDigitalPlan(user.id));
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${back}&notice=payment`);
  }
  redirect(`${back}&notice=payment`);
}

export async function stopDigitalPlanRenewal() {
  const user = await requireSeller();
  cancelDigitalPlan(user.id);
  redirect("/dashboard/digital?notice=cancel");
}

function ownedBuyDraft(id: string, userId: string) {
  const product = getProductById(id);
  if (!product || product.userId !== userId || product.cta !== "buy") return null;
  if (product.status !== "draft" && product.status !== "deactivated") return null;
  return product;
}

export async function confirmBuyPlan(formData: FormData) {
  const user = await requireSeller();
  const planId = text(formData, "plan");
  const extraSlots = Number(text(formData, "extra") || "0");
  const addSlots = Number(text(formData, "add") || "0");
  const safeExtra = Number.isInteger(extraSlots) ? extraSlots : -1;
  const draft = ownedBuyDraft(text(formData, "draft"), user.id);
  const published = sellerProducts(user.id).filter((product) => product.cta === "buy" && product.status === "published").length;
  const managementBack = `/dashboard/buy?add=${encodeURIComponent(String(addSlots || ""))}&plan=${encodeURIComponent(planId)}&extra=${encodeURIComponent(String(Math.max(safeExtra, 0)))}`;
  const back = draft
    ? `/dashboard/buy?draft=${encodeURIComponent(draft.id)}&choice=${encodeURIComponent(`${planId}:${Math.max(safeExtra, 0)}`)}`
    : managementBack;
  if (!Number.isInteger(addSlots) || addSlots < 0 || safeExtra < 0) redirect(`${back}&notice=choice`);
  if (draft) {
    const offer = publishBuyOffer({ current: activeBuyQuote(readBuySubscription(user.id)), published });
    const selected = publishChoice(`${planId}:${safeExtra}`, offer);
    if (offer.included || !selected || selected.planId !== planId || selected.extraSlots !== safeExtra) redirect(`${back}&notice=choice`);
  } else if (addSlots === 0) {
    const base = quoteBuyPlan(planId, 0);
    if (!base || safeExtra !== 0 || (base.listingLimit != null && published > base.listingLimit)) redirect(`${back}&notice=quota`);
  } else {
    const recommendation = recommendBuyTarget({
      current: activeBuyQuote(readBuySubscription(user.id)),
      published,
      addSlots,
    });
    if (!recommendation || !optionAllowed(recommendation, planId, safeExtra)) redirect(`${back}&notice=choice`);
  }
  const priced = buyPlanChange({
    userId: user.id,
    current: readBuySubscription(user.id),
    planId,
    extraSlots: safeExtra,
    published,
    now: new Date().toISOString(),
  });
  if (!priced.ok) redirect(`${back}&notice=${priced.reason}`);
  const result = commitBuyPlan({ id: newId("bill"), userId: user.id, planId, extraSlots: safeExtra });
  if (!result.ok) redirect(`${back}&notice=${result.reason}`);
  if (result.kind !== "bill" || result.chargeCents < 1) {
    redirect(draft ? `/dashboard/buy?draft=${encodeURIComponent(draft.id)}&notice=ready` : "/dashboard/buy?notice=saved");
  }
  if (!user.billingMethod) redirect(`/billing?next=${encodeURIComponent(back)}`);
  try {
    await redirectCollectionCheckout(user, stageBuyPlan(user.id), draft ? `/dashboard/buy?draft=${encodeURIComponent(draft.id)}` : "");
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${back}&notice=payment`);
  }
  redirect(`${back}&notice=payment`);
}

export async function publishBuyDraft(formData: FormData) {
  const user = await requireSeller();
  const product = ownedBuyDraft(text(formData, "id"), user.id);
  if (!product) redirect("/dashboard/buy");
  if (product.title.trim().length < 2 || product.images.length < 1) redirect(`/dashboard/products/${product.id}`);
  const claimed = claimBuyNowPublish(product.id, user.id);
  if (!claimed.ok) redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=${claimed.reason === "no_plan" ? "waiting" : claimed.reason}`);
  updateTag(productTag(user.publicId, product.slug));
  updateTag(sellerTag(user.publicId));
  redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=published`);
}

export async function publishBuyListing(formData: FormData) {
  const user = await requireSeller();
  const acting = await getImpersonation();
  const product = ownedBuyDraft(text(formData, "id"), user.id);
  if (!product) redirect("/dashboard/buy");
  if (product.title.trim().length < 2 || product.images.length < 1) redirect(`/dashboard/products/${product.id}`);
  if (activeBuyQuote(readBuySubscription(user.id))) {
    const claimed = claimBuyNowPublish(product.id, user.id);
    if (!claimed.ok) redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=${claimed.reason}`);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=published`);
  }
  const back = `/dashboard/buy?draft=${encodeURIComponent(product.id)}&fee=listing`;
  const waived = Boolean(acting) || product.feeExempt;
  if (!waived && !user.billingMethod) redirect(`/billing?next=${encodeURIComponent(back)}`);
  if (!waived && listingFeeCents(product.cta, false) > 0) {
    try {
      await redirectListingFee(user, product, back);
    } catch (error) {
      unstable_rethrow(error);
      redirect(`${back}&notice=payment`);
    }
    redirect(`${back}&notice=returned`);
  }
  if (product.status === "deactivated") reactivateProduct(product.id, user.id);
  else publishDraft(product.id, user.id);
  updateTag(productTag(user.publicId, product.slug));
  updateTag(sellerTag(user.publicId));
  redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=published`);
}

export async function stopBuyPlanRenewal() {
  const user = await requireSeller();
  cancelBuyPlan(user.id);
  redirect("/dashboard/buy?notice=cancel");
}

export async function payOpenFees() {
  const user = await requireSeller();
  prepareRenewalBills(user.id);
  const plan = plansFor(user.id)[0];
  if (!plan) redirect("/dashboard/payments?tab=receipts");
  try {
    await redirectCollectionCheckout(user, stageSellerCollection(user.id, plan.currency));
  } catch (error) {
    unstable_rethrow(error);
    redirect("/dashboard/payments?tab=receipts&billing=error");
  }
  redirect("/dashboard/payments?tab=receipts&billing=error");
}

export async function payToResume(formData: FormData) {
  const user = await requireSeller();
  const product = getProductById(text(formData, "id"));
  const back = safeNext(text(formData, "next"));
  if (!product || product.userId !== user.id) redirect(back || "/dashboard");
  if (product.cta === "file") redirect("/dashboard/digital");
  if (product.cta === "buy") redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}`);
  if (product.billingStatus !== "paused" && listingStillPaid(product)) redirect(back || "/dashboard");
  try {
    await redirectListingFee(user, product);
  } catch (error) {
    unstable_rethrow(error);
    redirect("/dashboard/payments?tab=receipts&billing=error");
  }
  redirect(back || "/dashboard");
}

export async function payAndPublish(formData: FormData) {
  const user = await requireSeller();
  const acting = await getImpersonation();
  const product = getProductById(text(formData, "id"));
  const back = safeNext(text(formData, "next"));
  if (!product || product.userId !== user.id || product.status === "published") redirect(back);
  if (product.cta === "file") {
    if (product.status === "draft" && (product.title.trim().length < 2 || product.images.length < 1)) {
      redirect(`/dashboard/products/${product.id}`);
    }
    const claimed = claimDigitalFilePublish(product.id, user.id);
    if (!claimed.ok) redirect(`/dashboard/digital?notice=${claimed.reason}`);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(back);
  }
  if (product.cta === "buy") {
    if (product.status === "draft" && (product.title.trim().length < 2 || product.images.length < 1)) {
      redirect(`/dashboard/products/${product.id}`);
    }
    const claimed = claimBuyNowPublish(product.id, user.id);
    if (!claimed.ok) redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=${claimed.reason}`);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=published`);
  }
  if (product.status === "deactivated" && listingStillPaid(product)) {
    resumePublished(product.id, user.id);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(back);
  }
  const waived = Boolean(acting) || product.feeExempt;
  if (!waived && !user.billingMethod) redirect(`/billing?next=${encodeURIComponent(back)}`);
  if (product.status === "draft" && (product.title.trim().length < 2 || product.images.length < 1)) {
    redirect(`/dashboard/products/${product.id}`);
  }
  const cents = waived ? 0 : listingFeeCents(product.cta);
  if (!waived && cents) {
    await redirectListingFee(user, product);
    redirect(back);
  }
  if (product.status === "deactivated") reactivateProduct(product.id, user.id);
  else publishDraft(product.id, user.id);
  updateTag(productTag(user.publicId, product.slug));
  updateTag(sellerTag(user.publicId));
  redirect(back);
}

export async function scheduleDeactivation(formData: FormData) {
  const user = await requireSeller();
  const back = safeNext(text(formData, "next"));
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id || product.status !== "published") redirect(back);
  deactivateNow(product.id, user.id);
  updateTag(productTag(user.publicId, product.slug));
  updateTag(sellerTag(user.publicId));
  redirect(back);
}

export async function reactivateTwig(formData: FormData) {
  const user = await requireSeller();
  const back = safeNext(text(formData, "next"));
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id) redirect(back);
  if (product.cta === "file" && product.status === "deactivated") {
    const claimed = claimDigitalFilePublish(product.id, user.id);
    if (!claimed.ok) redirect(`/dashboard/digital?notice=${claimed.reason}`);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(back);
  }
  if (product.cta === "buy" && product.status === "deactivated") {
    const claimed = claimBuyNowPublish(product.id, user.id);
    if (!claimed.ok) redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=${claimed.reason}`);
    updateTag(productTag(user.publicId, product.slug));
    updateTag(sellerTag(user.publicId));
    redirect(`/dashboard/buy?draft=${encodeURIComponent(product.id)}&notice=published`);
  }
  if (product.status === "deactivated") {
    if (!listingStillPaid(product)) redirect(back);
    resumePublished(product.id, user.id);
  } else if (product.status === "published") clearDeactivatesAt(product.id, user.id);
  updateTag(productTag(user.publicId, product.slug));
  updateTag(sellerTag(user.publicId));
  redirect(back);
}

const personSchema = {
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().min(7, "Enter a phone number.").max(30),
};

function chosenOrderDetails(formData: FormData, fulfillment: string, methods: string[], schedules: string[], askPayment = true):
  { ok: false; fieldErrors: Record<string, string> } | { ok: true; payment: string; pickupWindow: string } {
  const payment = text(formData, "paymentMethod");
  if (askPayment && methods.length > 0 && !methods.includes(payment)) {
    return { ok: false, fieldErrors: { paymentMethod: "Choose how you will pay." } };
  }
  if (fulfillment === "pickup") {
    const problem = pickupChoiceProblem(schedules, text(formData, "pickupTime"));
    if (problem) return { ok: false, fieldErrors: { pickupTime: problem } };
  }
  return {
    ok: true,
    payment: askPayment && methods.includes(payment) ? payment : "",
    pickupWindow: fulfillment === "pickup" ? text(formData, "pickupTime") : "",
  };
}

function deliveryInstructions(formData: FormData, fulfillment: string) {
  if (fulfillment !== "shipping") return { ok: true as const, note: "" };
  const note = text(formData, "deliveryNote").trim();
  if (note.length > 200) return { ok: false as const, fieldErrors: { deliveryNote: "Keep the delivery instructions under 200 characters." } };
  return { ok: true as const, note };
}

function sellerNoteOf(formData: FormData) {
  const note = text(formData, "sellerNote").trim();
  if (note.length > 400) return { ok: false as const, fieldErrors: { sellerNote: "Keep the note under 400 characters." } };
  return { ok: true as const, note };
}

function paymentSnapshot(
  products: { paymentMethods: string[]; paypalMe: string; venmoUsername: string }[],
  payment: string,
) {
  const source =
    products.find((item) => {
      if (!item.paymentMethods.includes(payment)) return false;
      if (payment === "paypal") return Boolean(item.paypalMe);
      if (payment === "venmo") return Boolean(item.venmoUsername);
      return true;
    }) ?? products[0];
  return {
    paypalMe: payment === "paypal" ? source?.paypalMe ?? "" : "",
    venmoUsername: payment === "venmo" ? source?.venmoUsername ?? "" : "",
  };
}

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = text(formData, "productId");
  const product = getProductById(productId);
  if (!product || !isTwigLive(product) || product.priceCents == null || (product.cta !== "buy" && product.cta !== "file")) {
    return { error: "This Twig is not available to buy." };
  }
  if (product.cta === "file" && twigigiFileHeld(product, findUserById(product.userId))) {
    return { error: "This file is not available." };
  }
  if (product.cta === "file" && product.fileLinks.length === 0) return { error: "This file is not ready yet." };
  if (product.quantityAvailable === 0) return { error: "This product is sold out." };

  const digital = product.cta === "file";
  const personalization = !digital ? await readOrderPersonalization(product.personalization, formData) : { ok: true as const, snapshot: null, images: [] as string[] };
  if (!personalization.ok) return { fieldErrors: personalization.errors };
  const customImages = personalization.images;
  const cap = product.quantityAvailable == null ? 20 : Math.min(20, product.quantityAvailable);
  const parsed = z
    .object({
      name: product.requireName ? personSchema.name : z.string().trim().max(80),
      email: personSchema.email,
      phone: product.requirePhone ? personSchema.phone : z.string().trim().max(30),
      quantity: z.coerce.number().int().min(1).max(Math.max(cap, 1)),
      fulfillment: digital ? z.literal("digital") : z.enum(["pickup", "delivery", "shipping"]),
      address: z.string().trim().max(300),
    })
    .safeParse({
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      quantity: text(formData, "quantity") || "1",
      fulfillment: digital ? "digital" : text(formData, "fulfillment"),
      address: digital ? "" : text(formData, "address"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.quantity > cap) return { fieldErrors: { quantity: `Only ${cap} available.` } };

  const selection = resolveSelection(product, text(formData, "variant"));
  if (!selection || selection.priceCents == null) return { error: "Choose an available option on the Twig." };
  if (!selection.available) return { error: "That combination is unavailable." };

  if (!digital) {
    const allowed = fulfillmentOptions(product).some((option) => option.id === parsed.data.fulfillment);
    if (!allowed) return { fieldErrors: { fulfillment: "Choose how you want to receive it." } };
    if (parsed.data.fulfillment !== "pickup" && parsed.data.fulfillment !== "digital" && methodsForFulfillment(product.paymentMethods, parsed.data.fulfillment).length === 0) {
      return { error: "Delivery and shipping have to be paid by transfer first. This seller has not set one up." };
    }
    if (parsed.data.fulfillment !== "pickup" && parsed.data.address.length < 4) {
      return { fieldErrors: { address: "Enter an address for delivery or shipping." } };
    }
  }
  const sellerUser = digital ? findUserById(product.userId) : null;
  const digitalMethods = digital ? digitalPayMethods({ paypalEmail: product.paypalEmail, stripeReady: Boolean(sellerUser?.stripeChargesEnabled) }) : [];
  if (digital && digitalMethods.length === 0) return { error: "This seller has not added a way to pay." };
  const payFulfillment = parsed.data.fulfillment === "delivery" || parsed.data.fulfillment === "shipping" ? parsed.data.fulfillment : "pickup";
  const payMethods = digital ? digitalMethods : methodsForFulfillment(product.paymentMethods, payFulfillment);
  if (!digital && payMethods.length === 0) return { error: "This seller has not added a way to pay." };
  const schedules = parsed.data.fulfillment === "pickup" ? [product.pickupTime] : [];
  const choice = chosenOrderDetails(formData, parsed.data.fulfillment, payMethods, schedules, true);
  if (!choice.ok) return { fieldErrors: choice.fieldErrors };
  if (!digital && isCashMethod(choice.payment) && parsed.data.fulfillment !== "pickup") {
    return { fieldErrors: { paymentMethod: "Cash is only for local pickup." } };
  }
  const instructions = deliveryInstructions(formData, parsed.data.fulfillment);
  if (!instructions.ok) return { fieldErrors: instructions.fieldErrors };
  const subtotal = selection.priceCents * parsed.data.quantity;
  const amount = digital ? subtotal : orderAmount(selection.priceCents, parsed.data.quantity, parsed.data.fulfillment, product);
  if (amount == null) return { error: "Could not calculate the total." };
  const shipping = amount - subtotal;
  const tax = 0;
  const total = subtotal + shipping + tax;

  if (!reserveStock(product.id, parsed.data.quantity)) return { error: "There aren't enough left." };

  const orderId = newId("ord");
  const sessionUser = await getCurrentUser();
  const emailMatch = findUserByEmail(parsed.data.email);
  const buyerId = sessionUser ? sessionUser.id : emailMatch?.id ?? null;
  try {
    insertOrder({
      id: orderId,
      productId: product.id,
      sellerId: product.userId,
      buyerId,
      buyerName: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      quantity: parsed.data.quantity,
      fulfillment: parsed.data.fulfillment as Fulfillment,
      address: parsed.data.fulfillment === "pickup" || parsed.data.fulfillment === "digital" ? "" : parsed.data.address,
      subtotalCents: subtotal,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: total,
      currency: product.currency,
      src: await trafficSource(),
      variantLabel: selection.label,
      fileLinks: digital ? product.fileLinks : [],
      filePassword: digital ? product.filePassword : "",
    });
    setOrderChoices(orderId, choice.payment, choice.pickupWindow, instructions.note);
    if (customImages.length > 0) setOrderCustomImages(orderId, customImages);
    if (personalization.snapshot) setOrderPersonalization(orderId, personalization.snapshot);
    setOrderPaymentSnapshot(
      orderId,
      paymentSnapshot([digital ? { ...product, paymentMethods: digitalMethods, paypalMe: "" } : product], choice.payment),
    );
    if (digital) {
      const plan = activePlanQuote(readDigitalSubscription(product.userId));
      const path = choice.payment === "card" ? "stripe_connect" : choice.payment === "paypal" ? "paypal_checkout" : "manual";
      const fee = snapshotPlatformFee({ path, amountCents: total, feeBps: plan?.feeBps ?? 0, planActive: Boolean(plan) });
      setOrderPlatformFee(orderId, { feeBps: fee.feeBps, feeCents: fee.feeCents, collected: fee.collected });
    }
    if (!digital) acceptPlacedOrder(orderId);
    if (choice.payment === "interac") setInteracPrompt(orderId, product.interacQuestion, product.interacPassword);
    openInteraction({
      kind: "order",
      sourceId: orderId,
      productId: product.id,
      sellerId: product.userId,
      buyerId,
      buyerEmail: parsed.data.email,
    });
  } catch {
    if (product.quantityAvailable != null) releaseStock(product.id, parsed.data.quantity);
    return { error: "Could not save this order. Try again." };
  }

  const seller = findUserById(product.userId);
  const notify = sellerNotifyEmails(product, seller?.email ?? "");
  if (notify.length > 0) {
    const order = getOrder(orderId);
    const lines = [
      "You have a new order on Twigigi.",
      "",
      `Product: ${product.title}`,
      selection.label ? `Option: ${selection.label}` : null,
      customImages.length > 0 ? "The buyer uploaded an image. Open the order to see it." : null,
      `Buyer: ${parsed.data.name}`,
      `Email: ${parsed.data.email}`,
      parsed.data.phone ? `Phone: ${parsed.data.phone}` : null,
      `Quantity: ${parsed.data.quantity}`,
      digital ? "Delivery: emailed automatically after PayPal or Stripe confirms the payment" : `Fulfillment: ${parsed.data.fulfillment}`,
      parsed.data.fulfillment === "pickup" && product.pickupNote.trim() ? `Pickup location: ${product.pickupNote.trim()}` : null,
      choice.pickupWindow ? `Pickup time: ${formatPickupChoice(choice.pickupWindow)}` : null,
      !digital && parsed.data.fulfillment !== "pickup" && parsed.data.address ? `Address: ${parsed.data.address}` : null,
      instructions.note ? `Delivery instructions: ${instructions.note}` : null,
      choice.payment ? `Payment: ${methodLabel(choice.payment)}` : null,
      `Total: ${formatMoney(total, product.currency)}`,
      order?.publicRef ? `Order: ${order.publicRef}` : null,
      digital
        ? "The buyer pays your PayPal or Stripe account. When the payment is confirmed, Twigigi emails the file."
        : isCashMethod(choice.payment)
          ? "The buyer pays cash at pickup. It stays unpaid until you confirm the cash. Cancel the order if you cannot fulfill it."
          : "The buyer pays you directly. Confirm the payment only after you see the money, then prepare pickup or shipping. Cancel the order if you cannot fulfill it.",
      "",
      `Open the order: ${appUrl()}/dashboard/orders/${orderId}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New order: ${product.title}`, text: lines.join("\n"), replyTo: parsed.data.email });
  }

  if (!digital) {
    const placed = getOrder(orderId);
    if (placed) {
      await notifyBuyer(placed, `Order placed: ${placed.productTitle}`, [
        `Order ${placed.publicRef || placed.productTitle} is placed.`,
        isCashMethod(choice.payment)
          ? "Pay the seller in cash when you pick it up. It stays unpaid until the seller confirms the cash."
          : "Pay the seller directly from the order page. Twigigi does not hold or guarantee the payment. Sending money before you receive the item is risky if you do not know the seller.",
      ]);
    }
  }

  if (digital) {
    const placed = getOrder(orderId);
    if (!placed) return { error: "Could not save this order. Try again." };
    let approveUrl = "";
    try {
      if (choice.payment === "card") {
        if (!getStripe() || !sellerUser?.stripeAccountId) {
          cancelUnpaidDigitalOrder(orderId);
          return { error: "Card checkout is not set up for this seller yet." };
        }
        setOrderStripeAccount(orderId, sellerUser.stripeAccountId);
        const session = await createDigitalStripeCheckout({
          orderId,
          amountCents: placed.totalCents || placed.amountCents,
          currency: placed.currency,
          itemName: placed.productTitle,
          buyerEmail: placed.email,
          accountId: sellerUser.stripeAccountId,
        });
        approveUrl = session.url;
      } else {
        const filePayee = safeEmail(product.paypalEmail);
        if (!filePayee || !paypalConfigured()) {
          cancelUnpaidDigitalOrder(orderId);
          return { error: filePayee ? "PayPal checkout is not set up on this server yet." : "This seller has not added a PayPal email." };
        }
        approveUrl = await beginDigitalPaypalCheckout(placed, filePayee);
      }
    } catch (error) {
      cancelUnpaidDigitalOrder(orderId);
      return { error: choice.payment === "card" ? "Stripe could not start this payment." : paypalCheckoutError(error) };
    }
    redirect(approveUrl);
  }

  redirect(`/order/${orderId}`);
}

export async function payDigitalFile(formData: FormData) {
  const id = text(formData, "id");
  const method = text(formData, "method") === "card" ? "card" : "paypal";
  const order = getOrder(id);
  if (!order || order.fulfillment !== "digital" || order.status === "canceled") redirect("/");
  if (order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled") redirect(`/order/${id}`);
  const product = getProductById(order.productId);
  const seller = product ? findUserById(product.userId) : null;
  try {
    if (method === "card") {
      if (!getStripe() || !seller?.stripeChargesEnabled || !seller.stripeAccountId) redirect(`/order/${id}?paypal=setup`);
      setOrderStripeAccount(id, seller.stripeAccountId);
      const session = await createDigitalStripeCheckout({
        orderId: id,
        amountCents: order.totalCents || order.amountCents,
        currency: order.currency,
        itemName: order.productTitle,
        buyerEmail: order.email,
        accountId: seller.stripeAccountId,
      });
      redirect(session.url);
    }
    const payee = safeEmail(product?.paypalEmail ?? "");
    if (!payee || !paypalConfigured()) redirect(`/order/${id}?paypal=setup`);
    const approveUrl = await beginDigitalPaypalCheckout(order, payee);
    redirect(approveUrl);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`/order/${id}?paypal=error`);
  }
}

export async function startStripeConnect(formData: FormData) {
  const user = await requireSeller();
  const country = text(formData, "country") === "US" ? "US" : "CA";
  try {
    const linked = await createStripeConnectLink({ accountId: user.stripeAccountId, email: user.email, country });
    if (!linked) redirect("/dashboard/payments?stripe=setup");
    if (linked.accountId) setStripeAccount(user.id, linked.accountId, user.stripeChargesEnabled);
    if (!linked.url) redirect(`/dashboard/payments?stripe=error&reason=${encodeURIComponent(linked.message || "Stripe could not open the connection page.")}`);
    redirect(linked.url);
  } catch (error) {
    unstable_rethrow(error);
    redirect("/dashboard/payments?stripe=error");
  }
}

export async function openStripePayout() {
  const user = await requireSeller();
  if (!user.stripeAccountId) redirect("/dashboard/payments");
  try {
    const linked = await createStripePayoutLink(user.stripeAccountId);
    if (!linked) redirect("/dashboard/payments?stripe=setup");
    if (!linked.url) redirect(`/dashboard/payments?stripe=error&reason=${encodeURIComponent(linked.message || "Stripe could not open the payout page.")}`);
    redirect(linked.url);
  } catch (error) {
    unstable_rethrow(error);
    redirect("/dashboard/payments?stripe=error");
  }
}

export async function beginBillingSetup(formData: FormData) {
  const user = await requireSeller();
  const method = text(formData, "method") === "paypal" ? "paypal" : "card";
  try {
    if (method === "paypal") {
      if (!paypalConfigured()) redirect("/dashboard/payments?tab=receipts&billing=paypal&reason=PayPal%20is%20not%20set%20up%20on%20this%20server%20yet.");
      const url = await beginPaypalBillingAgreement();
      redirect(url);
    }
    const cardSaved = cardCanRenew({
      method: user.billingMethod,
      ready: user.billingReady,
      authStatus: user.billingAuthStatus,
      paymentMethodId: user.billingPmId,
      consentVersion: user.billingConsentVersion,
    });
    if (!cardSaved && text(formData, "consent") !== "yes") {
      redirect("/dashboard/payments?tab=receipts&billing=error&reason=Check%20the%20automatic%20renewal%20agreement%20before%20saving%20a%20card.");
    }
    if (!cardSaved && !recordBillingConsent(user.id, BILLING_CONSENT_VERSION)) {
      redirect("/dashboard/payments?tab=receipts&billing=error");
    }
    const session = await createBillingSetupSession({ customerId: user.stripeCustomerId, email: user.email, userId: user.id, consentVersion: BILLING_CONSENT_VERSION });
    if (!session) redirect("/dashboard/payments?tab=receipts&billing=setup");
    if (session.customerId) rememberStripeCustomer(user.id, session.customerId);
    if (!session.url) redirect("/dashboard/payments?tab=receipts&billing=error");
    redirect(session.url);
  } catch (error) {
    unstable_rethrow(error);
    const raw = error instanceof Error ? error.message : "";
    const reason = method === "paypal" ? paypalBillingMessage(raw) : publicStripeError(raw);
    const code = method === "paypal" ? "paypal" : "error";
    redirect(`/dashboard/payments?tab=receipts&billing=${code}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`);
  }
}

export async function stopAutomaticRenewal() {
  const user = await requireSeller();
  revokeCardAuthorization(user.id);
  redirect("/dashboard/payments?tab=receipts&billing=stopped");
}

export async function setAutomaticPayment(formData: FormData) {
  const user = await requireSeller();
  if (text(formData, "enabled") !== "1") {
    setBillingAutoPay(user.id, false);
    redirect("/dashboard/payments?tab=receipts&billing=manual");
  }
  if (user.billingMethod === "paypal") {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=PayPal%20is%20manual%20payments%20only.");
  }
  if (text(formData, "consent") !== "yes") {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=Check%20the%20automatic%20payment%20agreement%20before%20turning%20it%20on.");
  }
  if (!recordBillingConsent(user.id, BILLING_CONSENT_VERSION)) {
    redirect("/dashboard/payments?tab=receipts&billing=error");
  }
  const current = findUserById(user.id);
  if (!current || !cardCanRenew({
    method: current.billingMethod,
    ready: current.billingReady,
    authStatus: current.billingAuthStatus,
    paymentMethodId: current.billingPmId,
    consentVersion: current.billingConsentVersion,
  })) {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=Save%20a%20card%20before%20automatic%20payment%20can%20be%20turned%20on.");
  }
  setBillingAutoPay(user.id, true);
  redirect("/dashboard/payments?tab=receipts");
}

export async function resumeAutomaticRenewal(formData: FormData) {
  const user = await requireSeller();
  if (text(formData, "consent") !== "yes") {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=Check%20the%20automatic%20renewal%20agreement%20before%20turning%20it%20back%20on.");
  }
  recordBillingConsent(user.id, BILLING_CONSENT_VERSION);
  if (!resumeCardAuthorization(user.id)) {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=Save%20a%20card%20again%20before%20turning%20automatic%20renewal%20on.");
  }
  redirect("/dashboard/payments?tab=receipts");
}

export async function payHeldCollection(formData: FormData) {
  const user = await requireSeller();
  const collection = collectionForSeller(text(formData, "id"), user.id);
  if (!collection) redirect("/dashboard/payments?tab=receipts");
  if (collection.status === "unknown") {
    redirect("/dashboard/payments?tab=receipts&billing=pending");
  }
  if (collection.providerPaymentId) {
    const intent = await retrieveFeeIntent(collection.providerPaymentId);
    if (intent?.status === "succeeded") {
      confirmProviderPayment({
        provider: "stripe",
        transactionId: intent.id,
        userId: user.id,
        collectionId: collection.id,
        paidAt: new Date().toISOString(),
        succeeded: true,
      });
      redirect(`/billing/complete?state=confirmed&collection=${collection.id}`);
    }
    if (!intent || intent.status === "processing" || intent.status === "unknown") {
      redirect("/dashboard/payments?tab=receipts&billing=pending");
    }
    if (intent.status === "requires_action") {
      const canceled = await cancelFeeIntent(intent.id);
      if (!canceled) redirect("/dashboard/payments?tab=receipts&billing=pending");
    }
    if (intent.status === "requires_action" || intent.status === "requires_payment_method" || intent.status === "canceled") {
      confirmProviderPayment({
        provider: "stripe",
        transactionId: intent.id,
        userId: user.id,
        collectionId: collection.id,
        paidAt: new Date().toISOString(),
        succeeded: false,
      });
    }
  }
  try {
    prepareRenewalBills(user.id);
    const plan = plansFor(user.id)[0];
    if (!plan) redirect("/dashboard/payments?tab=receipts");
    await redirectCollectionCheckout(user, stageSellerCollection(user.id, plan.currency));
  } catch (error) {
    unstable_rethrow(error);
    redirect("/dashboard/payments?tab=receipts&billing=error");
  }
  redirect("/dashboard/payments?tab=receipts&billing=error");
}

export async function placeCartOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const requested = readCartRequest(text(formData, "lines"));
  if (requested.length < 1) return { error: "Add a Twig before you check out." };
  const prepared = [];
  for (const line of requested) {
    const product = getProductById(line.productId);
    if (!product || !isTwigLive(product) || product.cta !== "buy" || product.priceCents == null) {
      return { error: "One of these Twigs is not available to buy." };
    }
    if (product.personalization.enabled && (product.personalization.fields.length > 0 || product.personalization.proof)) {
      return { error: `${product.title} asks for personalization. Open that Twig and use Buy now.` };
    }
    const first = prepared[0]?.product;
    if (first && (product.userId !== first.userId || product.currency !== first.currency)) {
      return { error: "Check out one seller at a time." };
    }
    const selection = resolveSelection(product, line.variantKey);
    if (!selection || selection.priceCents == null || !selection.available) return { error: "Choose an available option on each Twig." };
    const cap = product.quantityAvailable == null ? 20 : Math.min(20, product.quantityAvailable);
    const used = prepared.filter((item) => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
    if (line.quantity + used > cap) return { error: cap < 1 ? `${product.title} is sold out.` : `Only ${cap} of ${product.title} available.` };
    prepared.push({ product, selection, quantity: line.quantity });
  }

  const fulfillment = text(formData, "fulfillment");
  if (fulfillment !== "pickup" && fulfillment !== "delivery" && fulfillment !== "shipping") {
    return { fieldErrors: { fulfillment: "Choose how you want to receive it." } };
  }
  const shipLines = [];
  for (const line of prepared) {
    const option = fulfillmentOptions(line.product).find((item) => item.id === fulfillment);
    if (!option) return { error: `${line.product.title} can't be received that way. Remove it or choose another way.` };
    shipLines.push({ feeCents: option.feeCents, freeOverCents: option.freeOverCents });
  }
  const requireName = prepared.some((line) => line.product.requireName);
  const requirePhone = prepared.some((line) => line.product.requirePhone);
  const parsed = z
    .object({
      name: requireName ? personSchema.name : z.string().trim().max(80),
      email: personSchema.email,
      phone: requirePhone ? personSchema.phone : z.string().trim().max(30),
      address: z.string().trim().max(300),
    })
    .safeParse({
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      address: text(formData, "address"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const methods = prepared.map((line) => methodsForFulfillment(line.product.paymentMethods, fulfillment));
  const sharedMethods = methods[0].filter((id) => methods.every((list) => list.includes(id)));
  if (fulfillment !== "pickup" && sharedMethods.length === 0) {
    return { error: "Delivery and shipping have to be paid by transfer first. This seller has not set one up." };
  }
  if (sharedMethods.length === 0) return { error: "This seller has not added a way to pay." };
  if (fulfillment !== "pickup" && parsed.data.address.length < 4) {
    return { fieldErrors: { address: "Enter an address for delivery or shipping." } };
  }
  const schedules = fulfillment === "pickup" ? prepared.map((line) => line.product.pickupTime) : [];
  const choice = chosenOrderDetails(formData, fulfillment, sharedMethods, schedules, true);
  if (!choice.ok) return { fieldErrors: choice.fieldErrors };
  if (isCashMethod(choice.payment) && fulfillment !== "pickup") {
    return { fieldErrors: { paymentMethod: "Cash is only for local pickup." } };
  }
  const instructions = deliveryInstructions(formData, fulfillment);
  if (!instructions.ok) return { fieldErrors: instructions.fieldErrors };
  const sellerNote = sellerNoteOf(formData);
  if (!sellerNote.ok) return { fieldErrors: sellerNote.fieldErrors };
  const pickupLocation = fulfillment === "pickup"
    ? [...new Set(prepared.map((line) => line.product.pickupNote.trim()).filter(Boolean))].join("; ")
    : "";

  const merchandise = prepared.reduce((sum, line) => sum + (line.selection.priceCents ?? 0) * line.quantity, 0);
  const shipping = cartFulfillmentCharge(merchandise, shipLines);
  const total = merchandise + shipping;
  const reserved: { id: string; quantity: number }[] = [];
  for (const line of prepared) {
    if (!reserveStock(line.product.id, line.quantity)) {
      for (const item of reserved) releaseStock(item.id, item.quantity);
      return { error: `There aren't enough ${line.product.title} left.` };
    }
    reserved.push({ id: line.product.id, quantity: line.quantity });
  }

  const first = prepared[0];
  const orderId = newId("ord");
  const sessionUser = await getCurrentUser();
  const emailMatch = findUserByEmail(parsed.data.email);
  const buyerId = sessionUser ? sessionUser.id : emailMatch?.id ?? null;
  const lines = prepared.map((line) => ({
    productId: line.product.id,
    title: line.product.title,
    slug: line.product.slug,
    variantLabel: line.selection.label,
    quantity: line.quantity,
    unitCents: line.selection.priceCents ?? 0,
    subtotalCents: (line.selection.priceCents ?? 0) * line.quantity,
  }));
  try {
    insertOrder({
      id: orderId,
      productId: first.product.id,
      sellerId: first.product.userId,
      buyerId,
      buyerName: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      fulfillment,
      address: fulfillment === "pickup" ? "" : parsed.data.address,
      subtotalCents: merchandise,
      shippingCents: shipping,
      taxCents: 0,
      totalCents: total,
      currency: first.product.currency,
      src: await trafficSource(),
      variantLabel: lines.length === 1 ? lines[0].variantLabel : "",
      fileLinks: [],
      filePassword: "",
      lines: lines.length > 1 ? lines : [],
    });
    setOrderChoices(orderId, choice.payment, choice.pickupWindow, instructions.note, sellerNote.note);
    setOrderPaymentSnapshot(orderId, paymentSnapshot(prepared.map((line) => line.product), choice.payment));
    acceptPlacedOrder(orderId);
    if (choice.payment === "interac") {
      const prompt = prepared.find((line) => line.product.interacQuestion || line.product.interacPassword)?.product;
      if (prompt) setInteracPrompt(orderId, prompt.interacQuestion, prompt.interacPassword);
    }
    openInteraction({
      kind: "order",
      sourceId: orderId,
      productId: first.product.id,
      sellerId: first.product.userId,
      buyerId,
      buyerEmail: parsed.data.email,
    });
  } catch {
    for (const item of reserved) releaseStock(item.id, item.quantity);
    return { error: "Could not save this order. Try again." };
  }

  const seller = findUserById(first.product.userId);
  const notify = sellerNotifyEmails(first.product, seller?.email ?? "");
  if (notify.length > 0) {
    const order = getOrder(orderId);
    const itemLines = lines.flatMap((line) => [
      `${line.title}${line.variantLabel ? ` (${line.variantLabel})` : ""} × ${line.quantity} · ${formatMoney(line.subtotalCents, first.product.currency)}`,
    ]);
    const text = [
      "You have a new order on Twigigi.",
      "",
      ...itemLines,
      `Buyer: ${parsed.data.name}`,
      `Email: ${parsed.data.email}`,
      parsed.data.phone ? `Phone: ${parsed.data.phone}` : null,
      `Fulfillment: ${fulfillment}`,
      pickupLocation ? `Pickup location: ${pickupLocation}` : null,
      choice.pickupWindow ? `Pickup time: ${formatPickupChoice(choice.pickupWindow)}` : null,
      fulfillment !== "pickup" && parsed.data.address ? `Address: ${parsed.data.address}` : null,
      instructions.note ? `Delivery instructions: ${instructions.note}` : null,
      sellerNote.note ? `Note to seller: ${sellerNote.note}` : null,
      choice.payment ? `Payment: ${methodLabel(choice.payment)}` : null,
      `Items: ${formatMoney(merchandise, first.product.currency)}`,
      `Shipping: ${shipping === 0 ? "Free" : formatMoney(shipping, first.product.currency)}`,
      `Total: ${formatMoney(total, first.product.currency)}`,
      order?.publicRef ? `Order: ${order.publicRef}` : null,
      isCashMethod(choice.payment)
        ? "The buyer pays cash at pickup. It stays unpaid until you confirm the cash. Cancel the order if you cannot fulfill it."
        : "The buyer pays you directly. Confirm the payment only after you see the money, then prepare pickup or shipping. Cancel the order if you cannot fulfill it.",
      "",
      `Open the order: ${appUrl()}/dashboard/orders/${orderId}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New order from ${parsed.data.name}`, text: text.join("\n"), replyTo: parsed.data.email });
  }

  const placed = getOrder(orderId);
  if (placed) {
    await notifyBuyer(placed, `Order placed: ${placed.productTitle}`, [
      `Order ${placed.publicRef || placed.productTitle} is placed.`,
      isCashMethod(choice.payment)
        ? "Pay the seller in cash when you pick it up. It stays unpaid until the seller confirms the cash."
        : "Pay the seller directly from the order page. Twigigi does not hold or guarantee the payment. Sending money before you receive the item is risky if you do not know the seller.",
    ]);
  }

  redirect(`/order/${orderId}`);
}

function sellerNotifyEmails(
  product: { contactEmail: string; sellerContact: string; sellerContactMode: string },
  accountEmail: string,
) {
  const candidates = [product.contactEmail, accountEmail];
  if (product.sellerContactMode !== "phone") candidates.push(product.sellerContact);
  const emails: string[] = [];
  for (const item of candidates) {
    const email = item.trim().toLowerCase();
    if (!z.string().email().safeParse(email).success || emails.includes(email)) continue;
    emails.push(email);
  }
  return emails;
}

function readCartRequest(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    const merged = new Map<string, { productId: string; variantKey: string; quantity: number }>();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const productId = typeof row.productId === "string" ? row.productId : "";
      const variantKey = typeof row.variantKey === "string" ? row.variantKey : "";
      const quantity = Number(row.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;
      const key = `${productId}\n${variantKey}`;
      const current = merged.get(key);
      merged.set(key, { productId, variantKey, quantity: Math.min(20, (current?.quantity ?? 0) + quantity) });
    }
    return [...merged.values()].slice(0, 20);
  } catch {
    return [];
  }
}

export async function requestQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = text(formData, "productId");
  const product = getProductById(productId);
  if (!product || !isTwigLive(product) || product.cta !== "quote") {
    return { error: "This Twig is not taking quote requests." };
  }
  const quoteForm = product.quoteForm;
  const parsed = quoteForm
    ? z
        .object({
          name: quoteForm.askName ? personSchema.name : z.string().trim().max(80),
          email: personSchema.email,
          phone: quoteForm.askPhone ? personSchema.phone : z.string().trim().max(30),
          company: z.string().trim().max(80),
          address: quoteForm.askAddress ? z.string().trim().min(4, "Enter an address.").max(300) : z.string().trim().max(300),
          quantity: z.coerce.number().int().min(quoteForm.askQuantity && quoteForm.items.length === 0 ? 1 : 0).max(99),
          message: z.string().trim().max(2000),
        })
        .safeParse({
          name: text(formData, "name"),
          email: text(formData, "email"),
          phone: text(formData, "phone"),
          company: text(formData, "company"),
          address: text(formData, "address"),
          quantity: text(formData, "quantity") || (quoteForm.askQuantity && quoteForm.items.length === 0 ? "1" : "0"),
          message: text(formData, "message"),
        })
    : z
        .object({
          name: personSchema.name,
          email: personSchema.email,
          phone: personSchema.phone,
          company: z.string().trim().max(80),
          address: z.string().trim().max(300),
          quantity: z.coerce.number().int().min(1).max(99),
          message: z.string().trim().max(2000),
        })
        .safeParse({
          name: text(formData, "name"),
          email: text(formData, "email"),
          phone: text(formData, "phone"),
          company: "",
          address: "",
          quantity: text(formData, "quantity") || "1",
          message: text(formData, "message"),
        });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const lines: string[] = [];
  const questionErrors: Record<string, string> = {};
  let quantity = parsed.data.quantity;
  if (quoteForm) {
    if (parsed.data.company) lines.push(`Company: ${parsed.data.company}`);
    if (parsed.data.address) lines.push(parsed.data.address);
    const itemQuantities = quoteForm.items.map((item) => {
      const raw = text(formData, `item_${item.id}`);
      const amount = quoteForm.askQuantity ? Number(raw || "1") : 1;
      const safe = Number.isInteger(amount) && amount >= 0 && amount <= 99 ? amount : 1;
      lines.push(quoteForm.askQuantity ? `${item.description} × ${safe}` : item.description);
      return safe;
    });
    if (quoteForm.items.length > 0 && quoteForm.askQuantity) quantity = itemQuantities.reduce((sum, amount) => sum + amount, 0) || 1;
    for (const question of quoteForm.questions) {
      if (question.answer === "checks") {
        const picked = [
          ...new Set(
            formData
              .getAll(`question_${question.id}`)
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter((item) => question.choices.includes(item)),
          ),
        ];
        if (question.required && picked.length < 1) questionErrors[question.id] = "Choose at least one.";
        else if (picked.length > 0) lines.push(`${question.label}: ${picked.join(", ")}`);
        continue;
      }
      const answer = text(formData, `question_${question.id}`).trim().slice(0, 1000);
      if (question.required && answer.length < 1) questionErrors[question.id] = "This answer is required.";
      else if (answer) lines.push(`${question.label}: ${answer}`);
    }
  } else {
    const projectDetails = text(formData, "projectDetails").trim().slice(0, 2000);
    if (projectDetails) lines.push(projectDetails);
  }
  if (Object.keys(questionErrors).length > 0) return { fieldErrors: questionErrors };

  const uploads = formData.getAll("documents").filter((item): item is File => item instanceof File && item.size > 0);
  if (uploads.length > 4) return { fieldErrors: { documents: "Upload up to 4 files." } };
  let documents: { path: string; name: string }[] = [];
  try {
    documents = await saveQuoteDocuments(uploads);
  } catch (error) {
    return { fieldErrors: { documents: error instanceof Error ? error.message : "Use PNG, JPG, Word, or PDF files." } };
  }

  const id = newId("quo");
  const sessionUser = await getCurrentUser();
  const emailMatch = findUserByEmail(parsed.data.email);
  const projectDetails = lines.join("\n").slice(0, 2000);
  const requestKey = quoteRequestKey(parsed.data.email, projectDetails);
  insertQuote({
    id,
    productId: product.id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
    quantity: Math.max(quantity, 1),
    projectDetails,
    documents,
    src: await trafficSource(),
    billable: false,
    requestKey,
    feeReason: "included",
  });
  const quoteSeller = findUserById(product.userId);
  openInteraction({
    kind: "quote",
    sourceId: id,
    productId: product.id,
    sellerId: product.userId,
    buyerId: sessionUser?.id ?? emailMatch?.id ?? null,
    buyerEmail: parsed.data.email,
  });
  const notify = sellerNotifyEmails(product, quoteSeller?.email ?? "");
  if (notify.length > 0) {
    const details = lines.join("\n").trim();
    const note = [
      "You have a new quote request on Twigigi.",
      "",
      `Twig: ${product.title}`,
      `From: ${parsed.data.name}`,
      `Email: ${parsed.data.email}`,
      parsed.data.phone ? `Phone: ${parsed.data.phone}` : null,
      `Quantity: ${Math.max(quantity, 1)}`,
      details ? "" : null,
      details || null,
      "",
      `Open it: ${appUrl()}/dashboard/quotes/${id}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New quote: ${product.title}`, text: note.join("\n"), replyTo: parsed.data.email });
  }
  redirect(`/quote/${id}`);
}

export async function sendMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      productId: z.string().min(1),
      ...personSchema,
      message: z.string().trim().min(2, "Write a short message.").max(2000),
    })
    .safeParse({
      productId: text(formData, "productId"),
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      message: text(formData, "message"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const product = getProductById(parsed.data.productId);
  if (!product || !isTwigLive(product) || product.cta !== "contact") {
    return { error: "This Twig is not taking messages." };
  }
  const id = newId("msg");
  insertMessage({
    id,
    productId: product.id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
    src: await trafficSource(),
  });
  redirect(`/message/${id}`);
}

async function recordMoneyAction(formData: FormData, run: (id: string) => { ok: true } | { ok: false; error: string }) {
  await requireAdmin();
  const id = text(formData, "id");
  const result = run(id);
  const next = text(formData, "next") || `/admin/payments/${id}`;
  if (!result.ok) redirect(`${next}?error=${encodeURIComponent(result.error)}`);
  redirect(next);
}

export async function adminRemoveUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const next = "/admin/users";
  if (text(formData, "confirm") !== "yes") redirect(next);
  if (id === admin.id) redirect(`${next}?error=${encodeURIComponent("You can't remove your own account.")}`);
  const user = findUserById(id);
  if (!user) redirect(`${next}?error=${encodeURIComponent("That account was not found.")}`);
  if (user.role === "admin" && !listUsers().some((item) => item.role === "admin" && item.id !== user.id)) {
    redirect(`${next}?error=${encodeURIComponent("Keep at least one admin.")}`);
  }
  let removed: { publicId: string; slugs: string[] } | null = null;
  try {
    removed = deleteUserAccount(user.id);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${next}?error=${encodeURIComponent("That account was not removed.")}`);
  }
  if (!removed) redirect(`${next}?error=${encodeURIComponent("That account was not removed.")}`);
  insertModerationEvent({
    actorId: admin.id,
    action: "remove_user",
    targetKind: "user",
    targetId: user.id,
    note: user.publicId,
    toStatus: "removed",
  });
  updateTag(sellerTag(removed.publicId.toLowerCase()));
  for (const slug of removed.slugs) updateTag(productTag(removed.publicId.toLowerCase(), slug.toLowerCase()));
  redirect(next);
}

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const role = text(formData, "role") === "admin" ? "admin" : "user";
  const next = "/admin/users";
  if (id === admin.id) {
    redirect(`${next}?error=${encodeURIComponent("You can't change your own access.")}`);
  }
  const user = findUserById(id);
  if (!user) redirect(`${next}?error=${encodeURIComponent("That account was not found.")}`);
  if (user.role === "admin" && role !== "admin" && !listUsers().some((item) => item.role === "admin" && item.id !== user.id)) {
    redirect(`${next}?error=${encodeURIComponent("Keep at least one admin.")}`);
  }
  updateUserRole(user.id, role);
  updateTag(sellerTag(user.publicId.toLowerCase()));
  redirect(next);
}

export async function toggleFollowSeller(formData: FormData) {
  const user = await requireUser();
  const sellerId = findUserByUsername(text(formData, "seller"));
  const next = safeNext(text(formData, "next"));
  if (!sellerId || sellerId === user.id) redirect(next);
  toggleFollow(user.id, sellerId);
  redirect(next);
}

export async function toggleSaved(formData: FormData) {
  const user = await requireUser();
  const product = getProductById(text(formData, "productId"));
  const next = safeNext(text(formData, "next"));
  if (!product || !isTwigLive(product) || product.userId === user.id) redirect(next);
  toggleFavorite(user.id, product.id);
  redirect(next);
}

export async function toggleLikeAction(formData: FormData) {
  const product = getProductById(text(formData, "productId"));
  const next = safeNext(text(formData, "next"));
  if (!product || !isTwigLive(product)) redirect(next);
  const user = await getCurrentUser();
  if (user) {
    if (product.userId !== user.id) toggleLike(user.id, product.id);
  } else {
    toggleGuestLike(await ensureVisitor(), product.id);
  }
  redirect(next);
}

function score(formData: FormData, name: string) {
  const value = Number(text(formData, name));
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

export async function confirmInteraction(formData: FormData) {
  const user = await requireUser();
  const side = text(formData, "side") === "seller" ? "seller" : "buyer";
  const next = safeNext(text(formData, "next"));
  const interaction = getInteraction(text(formData, "id"));
  if (interaction?.kind === "order") {
    if (side === "seller") redirect(`${next}?error=${encodeURIComponent("Complete the order from the seller order page.")}`);
    const owns = (interaction.buyerId && interaction.buyerId === user.id) || interaction.buyerEmail === user.email.toLowerCase();
    if (!owns) redirect(`${next}?error=${encodeURIComponent("That interaction is not yours.")}`);
    const order = getOrder(interaction.sourceId);
    if (!order || !fulfillmentDone(order.fulfillmentState)) {
      redirect(`${next}?error=${encodeURIComponent("You can confirm receipt after the seller marks it ready or sent.")}`);
    }
    confirmBuyerReceipt(order.id);
  }
  const ok = confirmInteractionParty(text(formData, "id"), user.id, user.email, side);
  if (!ok) redirect(`${next}?error=${encodeURIComponent("That interaction is not yours.")}`);
  redirect(next);
}

export async function reviewSellerOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  const order = getOrder(id);
  if (!order || order.sellerId !== user.id) return { next: "/dashboard/orders" };
  const decision = text(formData, "decision");
  if (decision === "propose") {
    const note = text(formData, "proposalNote").trim().slice(0, 500);
    if (note.length < 4) return { next: `${back}?mail=note` };
    const amount = proposalAmount(text(formData, "proposalAmount"));
    if (amount === "invalid") return { next: `${back}?mail=amount` };
    if (!sellerReviewOrder(id, user.id, "propose", note, amount ?? 0)) return { next: back };
    const updated = getOrder(id);
    if (!updated) return { next: back };
    const sent = await notifyBuyer(updated, `Change proposed: ${updated.productTitle}`, [
      `${updated.displayName} proposed a change to order ${updated.publicRef}.`,
      note,
      amount ? `New total: ${formatMoney(amount, updated.currency)}` : "The total stays the same.",
      "Open the order to accept the change.",
    ]);
    return { next: sent ? back : `${back}?mail=0` };
  }
  if (decision === "decline") {
    if (!sellerReviewOrder(id, user.id, "decline")) return { next: back };
    if (order.lines.length > 0) {
      for (const line of order.lines) releaseStock(line.productId, line.quantity);
    } else releaseStock(order.productId, order.quantity);
    const updated = getOrder(id);
    if (updated) {
      const sent = await notifyBuyer(updated, `Order declined: ${updated.productTitle}`, [
        `${updated.displayName} declined order ${updated.publicRef}.`,
      ]);
      return { next: sent ? back : `${back}?mail=0` };
    }
    return { next: back };
  }
  if (!sellerReviewOrder(id, user.id, "accept")) return { next: back };
  const updated = getOrder(id);
  if (!updated) return { next: back };
  const product = getProductById(updated.productId);
  const sent = await notifyBuyer(updated, `Order confirmed: ${updated.productTitle}`, acceptNote(updated, product?.interacEmail ?? "", updated.paypalMe, updated.venmoUsername));
  return { next: sent ? back : `${back}?mail=0` };
}

export async function acceptSellerChange(formData: FormData) {
  const id = text(formData, "id");
  const order = getOrder(id);
  const back = `/order/${id}`;
  if (!order) redirect("/orders");
  const user = await getCurrentUser();
  if (user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase()) redirect(back);
  if (!acceptOrderProposal(id)) redirect(back);
  const next = getOrder(id);
  if (next) {
    const product = getProductById(next.productId);
    await notifyBuyer(next, `Order confirmed: ${next.productTitle}`, acceptNote(next, product?.interacEmail ?? "", next.paypalMe, next.venmoUsername));
  }
  redirect(back);
}

export async function rollbackOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  rollbackOrderStatus(id, user.id);
  return { next: back };
}

export async function confirmBuyerPickup(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const back = `/order/${id}`;
  const order = getOrder(id);
  if (!order) return { next: "/orders" };
  const user = await getCurrentUser();
  if (user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase()) return { next: back };
  const choice = text(formData, "pickupTime").trim().slice(0, 16);
  if (!confirmBuyerPickupTime(id, choice)) return { error: "Choose one of the suggested times." };
  const note = text(formData, "note").trim().slice(0, 500);
  if (note) addPickupMessage(id, "buyer", note);
  const next = getOrder(id);
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  if (next && product && seller) {
    const notify = sellerNotifyEmails(product, seller.email);
    const when = next.pickupWindow ? formatPickupChoice(next.pickupWindow) : "";
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: `Pickup time confirmed: ${next.productTitle}`,
        text: [
          `${next.buyerName} confirmed the pickup time and location for order ${next.publicRef}.`,
          when ? `Pickup time: ${when}` : "",
          next.pickupPlace ? `Pickup location: ${next.pickupPlace}` : "",
          note ? `Note: ${note}` : "",
          "You can mark it ready for pickup.",
          "",
          `${appUrl()}/dashboard/orders/${next.id}`,
        ].filter(Boolean).join("\n"),
        replyTo: next.email,
      });
    }
  }
  return { next: back };
}

export async function sendOrderProof(_prev: FormState, formData: FormData): Promise<FormState> {
  const seller = await requireSeller();
  if (!seller) redirect("/login");
  const id = text(formData, "id");
  const order = getOrder(id);
  if (!order || order.sellerId !== seller.id || !order.personalization?.proofRequested) return { error: "This order does not ask for a proof." };
  if (!(order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled")) return { error: "Send the proof after payment is confirmed." };
  const files = formData.getAll("proof").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length < 1 || files.length > PERSONALIZATION_FILE_LIMIT) return { error: "Add 1 to 3 proof images. JPG, PNG, or WebP, under 5 MB each." };
  let paths: string[] = [];
  try {
    paths = await saveImages(files);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Use JPG, PNG, or WebP photos under 5 MB." };
  }
  const snapshot = addProof(order.personalization, {
    id: `prf_${randomBytes(4).toString("hex")}`,
    note: text(formData, "note").trim().slice(0, 400),
    files: paths.map((filePath, index) => ({ path: filePath, name: files[index].name.split(/[/\\]/).pop()?.slice(0, 80) || "proof" })),
    createdAt: new Date().toISOString(),
    current: true,
  });
  setOrderPersonalization(id, snapshot);
  await sendOrderEmail([order.email], {
    subject: `Proof ready: ${order.productTitle}`,
    text: [`A proof is ready for order ${order.publicRef}.`, "Open the order to approve it or request changes.", "", `${appUrl()}/order/${order.id}`].join("\n"),
    replyTo: seller.email,
  });
  redirect(`/dashboard/orders/${id}`);
}

export async function reviewOrderProof(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const back = `/order/${id}`;
  const order = getOrder(id);
  if (!order?.personalization) return { next: back };
  const user = await getCurrentUser();
  if (user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase()) return { next: back };
  const decision = text(formData, "decision") === "approved" ? "approved" : "changes";
  const result = decideProof(order.personalization, decision, text(formData, "note").trim());
  if (!result.ok) return { error: result.error };
  setOrderPersonalization(id, result.snapshot);
  const seller = findUserById(order.sellerId);
  if (seller) {
    await sendOrderEmail([seller.email], {
      subject: decision === "approved" ? `Proof approved: ${order.productTitle}` : `Proof changes requested: ${order.productTitle}`,
      text: [`${order.buyerName} ${decision === "approved" ? "approved the current proof" : "requested changes to the current proof"} for order ${order.publicRef}.`, result.snapshot.decisionNote, "", `${appUrl()}/dashboard/orders/${order.id}`].filter(Boolean).join("\n"),
      replyTo: order.email,
    });
  }
  redirect(back);
}

export async function requestAnotherPickup(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const back = `/order/${id}`;
  const order = getOrder(id);
  if (!order) return { next: "/orders" };
  const user = await getCurrentUser();
  if (user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase()) return { next: back };
  const pickupWindow = text(formData, "pickupTime").trim().slice(0, 16);
  const productIds = [...new Set((order.lines.length > 0 ? order.lines.map((line) => line.productId) : [order.productId]).filter(Boolean))];
  const schedules = productIds.map((productId) => getProductById(productId)?.pickupTime ?? "");
  const problem = pickupChoiceProblem(schedules, pickupWindow);
  if (problem) return { error: problem === "The seller has not set pickup days." ? "The seller has not set pickup days." : "Choose one of the available pickup times." };
  if (!requestAnotherPickupTime(id, pickupWindow)) return { error: "That time could not be sent." };
  const note = text(formData, "note").trim().slice(0, 500);
  if (note) addPickupMessage(id, "buyer", note);
  const next = getOrder(id);
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  if (next && product && seller) {
    const notify = sellerNotifyEmails(product, seller.email);
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: `Another pickup time: ${next.productTitle}`,
        text: [
          `${next.buyerName} asked for another pickup time for order ${next.publicRef}.`,
          `Pickup time: ${formatPickupChoice(next.pickupWindow)}`,
          note ? `Note: ${note}` : "",
          "Confirm this time and location, or send other times.",
          "",
          `${appUrl()}/dashboard/orders/${next.id}`,
        ].filter(Boolean).join("\n"),
        replyTo: next.email,
      });
    }
  }
  return { next: back };
}

export async function leavePickupNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const order = getOrder(id);
  if (!order) return { error: "That order was not found." };
  const user = await getCurrentUser();
  const sellerSide = Boolean(user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase());
  const buyerSide = !user || Boolean(user.id === order.buyerId || user.email.toLowerCase() === order.email.toLowerCase());
  if (!sellerSide && !buyerSide) return { error: "You cannot leave a note on this order." };
  const back = sellerSide ? `/dashboard/orders/${id}` : `/order/${id}`;
  if (!addPickupMessage(id, sellerSide ? "seller" : "buyer", text(formData, "note"))) return { error: "Write a short note." };
  return { next: back };
}

export async function confirmPickupTime(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  if (!confirmOrderPickupTime(id, user.id)) return { next: back };
  const order = getOrder(id);
  if (!order) return { next: back };
  const when = order.pickupWindow ? formatPickupChoice(order.pickupWindow) : "";
  const sent = await notifyBuyer(order, `Pickup time confirmed: ${order.productTitle}`, [
    `${order.displayName} confirmed the pickup time and location for order ${order.publicRef}.`,
    when ? `Pickup time: ${when}` : "They confirmed the pickup time.",
    order.pickupPlace ? `Pickup location: ${order.pickupPlace}` : "",
  ].filter(Boolean));
  return { next: sent ? back : `${back}?mail=0` };
}

export async function arrangePickupTime(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  const reschedule = text(formData, "reschedule") === "1";
  const listed = formData.getAll("pickupTimes").map((item) => String(item).trim().slice(0, 16)).filter(Boolean);
  const pickupWindow = text(formData, "pickupTime").trim().slice(0, 16);
  const times = reschedule ? [pickupWindow] : listed.length > 0 ? listed : pickupWindow ? [pickupWindow] : [];
  const existing = getOrder(id);
  if (!existing || existing.sellerId !== user.id) return { next: back };
  const productIds = [...new Set((existing.lines.length > 0 ? existing.lines.map((line) => line.productId) : [existing.productId]).filter(Boolean))];
  const schedules = productIds.map((productId) => getProductById(productId)?.pickupTime ?? "");
  for (const time of times) {
    const problem = pickupChoiceProblem(schedules, time);
    if (problem) {
      const error = problem === "The seller has not set pickup days."
        ? "Add pickup days on the product first."
        : problem === "Choose a time the seller offered."
          ? "Choose one of your available pickup times."
          : "Choose a pickup time.";
      return { error };
    }
  }
  if (times.length < 1) return { error: "Add at least one pickup time." };
  const saved = reschedule || listed.length === 0
    ? setSellerPickupTime(id, user.id, times[0], reschedule)
    : setSellerPickupOptions(id, user.id, times);
  if (!saved) return { error: "Those pickup times could not be saved." };
  const note = text(formData, "note").trim().slice(0, 500);
  if (note) addPickupMessage(id, "seller", note);
  const order = getOrder(id);
  if (!order) return { next: back };
  const offered = order.pickupOptions.length > 0 ? order.pickupOptions : [order.pickupWindow];
  const when = offered.map((time) => formatPickupChoice(time)).filter(Boolean);
  const sent = await notifyBuyer(order, `${reschedule ? "New pickup time" : "Pickup times suggested"}: ${order.productTitle}`, [
    reschedule
      ? `${order.displayName} suggested a new pickup time for order ${order.publicRef}.`
      : `${order.displayName} suggested pickup times for order ${order.publicRef}.`,
    ...when.map((time) => `Pickup time: ${time}`),
    note ? `Note: ${note}` : "",
    "Open the order. If none of these times work, choose another time. When you agree, confirm the pickup time and location.",
  ].filter(Boolean));
  return { next: sent ? back : `${back}?mail=0` };
}

export async function confirmPaymentAndHandover(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  const handoverOnly = text(formData, "handoverOnly") === "1";
  if (!confirmCashHandover(id, user.id, handoverOnly)) return { next: back };
  const order = getOrder(id);
  if (!order) return { next: back };
  const sent = await notifyBuyer(order, `Order completed: ${order.productTitle}`, [
    handoverOnly
      ? `${order.displayName} handed over order ${order.publicRef}.`
      : `${order.displayName} confirmed the cash and handed over order ${order.publicRef}.`,
    "The order is complete. You can leave a review when you are ready.",
  ]);
  return { next: sent ? back : `${back}?mail=0` };
}

export async function confirmOrderPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  const existing = getOrder(id);
  if (!existing || existing.fulfillment === "digital") return { next: back };
  if (!confirmOrderPaymentReceived(id, user.id)) return { next: back };
  const order = getOrder(id);
  if (!order) return { next: back };
  const sent = order.fulfillment === "digital"
    ? await sendPaymentConfirmed(id)
    : isCashMethod(order.buyerPayment)
      ? await notifyBuyer(order, `Cash received: ${order.productTitle}`, [
          `${order.displayName} confirmed the cash for order ${order.publicRef}.`,
          "The order stays open until the item is handed over.",
        ])
      : await notifyBuyer(order, `Payment confirmed: ${order.productTitle}`, [
        `${order.displayName} confirmed your payment for order ${order.publicRef}.`,
        shipsToBuyer(order.fulfillment)
          ? "They will email you when it is sent out for delivery."
          : "They will email you when it is ready for pickup.",
      ]);
  return { next: sent ? back : `${back}?mail=0` };
}

export async function markOrderProgress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  const state = text(formData, "state") === "sent" ? "sent" : "ready";
  let shipment: { carrier: string; tracking: string } | undefined;
  if (state === "sent") {
    const picked = text(formData, "carrier").trim();
    const named = text(formData, "carrierName").trim();
    const carrier = (picked === "other" ? named : picked).slice(0, 40);
    const tracking = text(formData, "tracking").trim().slice(0, 40);
    if (carrier.length < 2 || tracking.length < 4) return { next: `${back}?mail=ship` };
    shipment = { carrier, tracking };
  }
  if (!markOrderFulfillment(id, user.id, state, shipment)) return { next: back };
  const order = getOrder(id);
  if (!order) return { next: back };
  const product = getProductById(order.productId);
  const place = order.fulfillment === "pickup" ? product?.pickupNote.trim() ?? "" : "";
  const sent = await notifyBuyer(
    order,
    state === "ready" ? `Ready for pickup: ${order.productTitle}` : `Sent: ${order.productTitle}`,
    readyNote(order, place),
  );
  return { next: sent ? back : `${back}?mail=0` };
}

export async function bulkSellerOrders(formData: FormData) {
  const user = await requireSeller();
  const action = text(formData, "action");
  const allowed: SellerBulkAction[] = ["confirm-payment", "accept", "ready"];
  const ids = [...new Set(formData.getAll("id").filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 100);
  let updated = 0;
  let skipped = 0;
  if (!allowed.includes(action as SellerBulkAction)) {
    redirect("/dashboard/orders?bulk=0&skipped=0");
  }
  for (const id of ids) {
    const order = getOrder(id);
    if (!order || order.sellerId !== user.id || !sellerBulkActions(order).includes(action as SellerBulkAction)) {
      skipped += 1;
      continue;
    }
    const data = new FormData();
    data.set("id", id);
    if (action === "confirm-payment") {
      const wasPaid = order.paymentStatus === "paid" || order.status === "paid";
      await confirmOrderPayment({}, data);
      const after = getOrder(id);
      const paid = after?.paymentStatus === "paid" || after?.status === "paid";
      if (!wasPaid && paid) updated += 1;
      else skipped += 1;
    } else if (action === "accept") {
      data.set("decision", "accept");
      await reviewSellerOrder({}, data);
      updated += getOrder(id)?.reviewState === "accepted" ? 1 : 0;
      if (getOrder(id)?.reviewState !== "accepted") skipped += 1;
    } else {
      data.set("state", "ready");
      await markOrderProgress({}, data);
      if (getOrder(id)?.fulfillmentState === "ready") updated += 1;
      else skipped += 1;
    }
  }
  redirect(`/dashboard/orders?bulk=${updated}&skipped=${skipped}`);
}

export async function changeOrderPayment(formData: FormData) {
  const id = text(formData, "id");
  const method = text(formData, "method");
  const back = `/order/${id}`;
  const order = getOrder(id);
  if (!order) redirect("/orders");
  if (order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled" || order.status === "canceled") redirect(back);
  const product = getProductById(order.productId);
  const fulfillment = order.fulfillment === "delivery" || order.fulfillment === "shipping" ? order.fulfillment : "pickup";
  const methods = product && order.fulfillment !== "digital" ? methodsForFulfillment(product.paymentMethods, fulfillment) : [];
  if (!product || !methods.includes(method)) redirect(`${back}?pay=choose`);
  if (!setBuyerPaymentMethod(id, method)) redirect(back);
  setOrderPaymentSnapshot(id, paymentSnapshot([product], method));
  if (method === "interac") setInteracPrompt(id, product.interacQuestion, product.interacPassword);
  redirect(back);
}

export async function buyerReportPayment(formData: FormData) {
  const id = text(formData, "id");
  const method = text(formData, "method");
  const back = `/order/${id}`;
  const order = getOrder(id);
  if (!order) redirect("/orders");
  const product = getProductById(order.productId);
  const fulfillment = order.fulfillment === "delivery" || order.fulfillment === "shipping" ? order.fulfillment : "pickup";
  const methods = product && order.fulfillment !== "digital" ? methodsForFulfillment(product.paymentMethods, fulfillment) : [];
  if (!methods.includes(method)) redirect(`${back}?pay=method`);
  if (method === "interac" && product) setInteracPrompt(id, product.interacQuestion, product.interacPassword);
  if (!recordBuyerPayment(id, method)) redirect(back);
  const seller = findUserById(order.sellerId);
  if (product && seller) {
    const notify = sellerNotifyEmails(product, seller.email);
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: `Payment sent: ${order.productTitle}`,
        text: [
          `${order.buyerName} says they sent ${methodLabel(method)} for order ${order.publicRef}.`,
          "This is not paid yet. Confirm it only after you see the money.",
          "",
          `${appUrl()}/dashboard/orders/${id}`,
        ].join("\n"),
        replyTo: order.email,
      });
    }
  }
  redirect(back);
}

export async function saveAutoConfirm(formData: FormData) {
  const user = await requireSeller();
  setAutoConfirm(user.id, text(formData, "enabled") === "1");
  redirect("/dashboard");
}

export async function confirmReceipt(formData: FormData) {
  const id = text(formData, "id");
  const order = getOrder(id);
  const back = `/order/${id}`;
  if (!order) redirect("/orders");
  const user = await getCurrentUser();
  if (user && user.id === order.sellerId && user.email.toLowerCase() !== order.email.toLowerCase()) redirect(back);
  if (!confirmBuyerReceipt(id)) redirect(`${back}?error=${encodeURIComponent("You can confirm receipt after the seller marks it ready or sent.")}`);
  if (user) {
    const interaction = getInteractionBySource(order.id);
    if (interaction) confirmInteractionParty(interaction.id, user.id, user.email, "buyer");
  }
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  if (product && seller) {
    const notify = sellerNotifyEmails(product, seller.email);
    const digital = order.fulfillment === "digital";
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: digital ? `File access confirmed: ${order.productTitle}` : `Receipt confirmed: ${order.productTitle}`,
        text: [
          digital
            ? `${order.buyerName} could open the file for order ${order.publicRef}.`
            : `${order.buyerName} confirmed receipt of order ${order.publicRef}.`,
          "You can mark the order complete.",
          "",
          `${appUrl()}/dashboard/orders/${order.id}`,
        ].join("\n"),
        replyTo: order.email,
      });
    }
  }
  redirect(back);
}

const FILE_ISSUE_REASONS: Record<string, string> = {
  link: "Link doesn't work",
  access: "Access denied",
  password: "Incorrect password",
  file: "Wrong or missing file",
};

export async function reportDigitalFileIssue(formData: FormData) {
  const id = text(formData, "id");
  const order = getOrder(id);
  const back = `/order/${id}`;
  if (!order || order.fulfillment !== "digital" || order.status === "canceled") redirect("/");
  const reason = FILE_ISSUE_REASONS[text(formData, "reason")];
  if (!reason) redirect(back);
  setOrderFileIssue(id, reason);
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  if (product && seller) {
    const notify = sellerNotifyEmails(product, seller.email);
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: `File issue: ${order.productTitle}`,
        text: [
          `${order.buyerName} could not use the file for order ${order.publicRef}.`,
          `Issue: ${reason}`,
          "",
          `${appUrl()}/dashboard/orders/${order.id}`,
        ].join("\n"),
        replyTo: order.email,
      });
    }
  }
  redirect(`${back}?file=help`);
}

export async function completeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  completeSellerOrder(id, user.id);
  return { next: `/dashboard/orders/${id}` };
}

function proposalAmount(raw: string) {
  const trimmed = raw.trim().replace(/[$,]/g, "");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0.5) return "invalid" as const;
  return Math.round(value * 100);
}

export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const interaction = getInteraction(text(formData, "interactionId"));
  const owns = interaction && (interaction.buyerId === user.id || interaction.buyerEmail === user.email.toLowerCase());
  if (!interaction || !owns) return { error: "That order is not yours." };
  if (interaction.kind === "order") {
    const order = getOrder(interaction.sourceId);
    if (!order || !fulfillmentDone(order.fulfillmentState)) return { error: "You can review after the seller marks the order ready or sent." };
  }
  if (!interaction.buyerConfirmedAt) confirmInteractionParty(interaction.id, user.id, user.email, "buyer");
  const overall = score(formData, "overall");
  const asDescribed = score(formData, "asDescribed");
  const communication = score(formData, "communication");
  const reliability = score(formData, "reliability");
  const quality = interaction.kind === "quote" ? score(formData, "quality") : null;
  if (!overall || !asDescribed || !communication || !reliability || (interaction.kind === "quote" && !quality)) {
    return { fieldErrors: { overall: "Choose each rating from 1 to 5." } };
  }
  const files = formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 2) return { fieldErrors: { images: "Add up to 2 photos." } };
  let images: string[] = [];
  try {
    images = await saveImages(files);
  } catch (error) {
    return { fieldErrors: { images: error instanceof Error ? error.message : "Use JPG, PNG, or WebP photos." } };
  }
  try {
    insertReview({
      id: newId("rev"),
      userId: user.id,
      sellerId: interaction.sellerId,
      productId: interaction.productId,
      interactionId: interaction.id,
      overall,
      asDescribed,
      communication,
      reliability,
      quality,
      body: text(formData, "body").trim().slice(0, 500),
      images,
    });
  } catch {
    return { error: "This interaction already has a review." };
  }
  const seller = findUserById(interaction.sellerId);
  if (seller) updateTag(sellerTag(seller.publicId));
  const product = getProductById(interaction.productId);
  if (product && seller) updateTag(productTag(seller.publicId, product.slug));
  return { saved: true };
}

export async function adminConfirmInteraction(formData: FormData) {
  await requireAdmin();
  const side = text(formData, "side") === "seller" ? "seller" : "buyer";
  adminSetConfirmation(text(formData, "id"), side, text(formData, "on") === "1");
  redirect("/admin/interactions");
}

export async function adminSaveReview(formData: FormData) {
  await requireAdmin();
  const overall = score(formData, "overall");
  const asDescribed = score(formData, "asDescribed");
  const communication = score(formData, "communication");
  const reliability = score(formData, "reliability");
  const qualityRaw = text(formData, "quality");
  const quality = qualityRaw ? score(formData, "quality") : null;
  if (!overall || !asDescribed || !communication || !reliability || (qualityRaw && !quality)) {
    redirect("/admin/reviews?error=Choose%20each%20rating%20from%201%20to%205.");
  }
  const reviewId = text(formData, "id");
  updateReview(reviewId, {
    overall,
    asDescribed,
    communication,
    reliability,
    quality,
    body: text(formData, "body").trim().slice(0, 500),
  });
  refreshReview(reviewId);
  redirect("/admin/reviews");
}

export async function adminRemoveReview(formData: FormData) {
  await requireAdmin();
  const reviewId = text(formData, "id");
  const placement = reviewPlacement(reviewId);
  deleteReview(reviewId);
  if (placement) refreshReviewTags(placement);
  redirect("/admin/reviews");
}

function refreshReview(id: string) {
  const placement = reviewPlacement(id);
  if (placement) refreshReviewTags(placement);
}

function refreshReviewTags(placement: { username: string; slug: string }) {
  updateTag(sellerTag(placement.username));
  if (placement.slug) updateTag(productTag(placement.username, placement.slug));
}

export async function updateSellerBio(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const bio = text(formData, "bio").trim().replace(/\s+/g, " ").slice(0, 280);
  updateUserBio(user.id, bio);
  updateTag(sellerTag(user.publicId.toLowerCase()));
  return { next: safeNext(text(formData, "next")) };
}

export async function updateAccountUsername(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const claimed = claimPublicUsername(user.id, text(formData, "username"));
  if (claimed.fieldErrors || claimed.error) return claimed;
  updateTag(sellerTag(user.publicId.toLowerCase()));
  return { next: safeNext(text(formData, "next")) };
}

export async function updateAccountDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = signupSchema.shape.displayName.safeParse(text(formData, "displayName"));
  if (!parsed.success) return { fieldErrors: { displayName: "Enter your name." } };
  updateDisplayName(user.id, parsed.data);
  updateTag(sellerTag(user.publicId.toLowerCase()));
  return { next: safeNext(text(formData, "next")) };
}

export async function adminRenameUser(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "displayName").trim();
  if (name.length < 2 || name.length > 60) redirect("/admin/users?error=Enter%20a%20name.");
  updateDisplayName(text(formData, "id"), name);
  redirect("/admin/users");
}

export async function enterSellerAccount(formData: FormData) {
  if (await getImpersonation()) redirect("/dashboard");
  const admin = await requireAdmin();
  const seller = findUserById(text(formData, "id"));
  if (!seller || seller.id === admin.id) redirect("/admin/users");
  await setSession(seller.id, admin.id);
  redirect("/dashboard");
}

export async function exitSellerAccount() {
  const admin = await getImpersonation();
  if (!admin) redirect("/dashboard");
  await setSession(admin.id);
  redirect("/admin/users");
}

export async function setListingRenewal(formData: FormData) {
  const user = await requireSeller();
  const back = safeNext(text(formData, "next"));
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id) redirect(back || "/dashboard");
  const renew = text(formData, "renew") === "1";
  if (renew && product.billingStatus === "legacy_review") redirect(back || "/dashboard");
  if (renew && !cardCanRenew({
    method: user.billingMethod,
    ready: user.billingReady,
    authStatus: user.billingAuthStatus,
    paymentMethodId: user.billingPmId,
    consentVersion: user.billingConsentVersion,
  })) {
    redirect("/dashboard/payments?tab=receipts&billing=error&reason=Save%20a%20card%20and%20agree%20to%20automatic%20renewal%20before%20turning%20it%20on%20for%20a%20listing.");
  }
  setListingAutoRenew(product.id, user.id, renew);
  redirect(back || "/dashboard");
}

export async function setListingFree(formData: FormData) {
  const actor = await getImpersonation();
  const admin = actor ?? (await getCurrentUser());
  const back = safeNext(text(formData, "next"));
  if (!admin || admin.role !== "admin") redirect("/dashboard");
  const product = getProductById(text(formData, "id"));
  if (!product) redirect(back || "/admin/twigs");
  if (actor) {
    const seller = await getCurrentUser();
    if (!seller || product.userId !== seller.id) redirect("/dashboard");
  }
  setListingFeeExempt(product.id, text(formData, "free") === "1");
  const owner = findUserById(product.userId);
  if (owner) {
    updateTag(productTag(owner.publicId, product.slug));
    updateTag(sellerTag(owner.publicId));
  }
  redirect(back || "/admin/twigs");
}

export async function setQuoteFeeFree(formData: FormData) {
  const actor = await getImpersonation();
  const admin = actor ?? (await getCurrentUser());
  const back = safeNext(text(formData, "next"));
  if (!admin || admin.role !== "admin") redirect("/dashboard");
  const product = getProductById(text(formData, "id"));
  if (!product) redirect(back || "/admin/twigs");
  if (actor) {
    const seller = await getCurrentUser();
    if (!seller || product.userId !== seller.id) redirect("/dashboard");
  }
  setQuoteFeeExempt(product.id, text(formData, "free") === "1");
  const owner = findUserById(product.userId);
  if (owner) {
    updateTag(productTag(owner.publicId, product.slug));
    updateTag(sellerTag(owner.publicId));
  }
  redirect(back || "/admin/twigs");
}

export async function copyTwig(formData: FormData) {
  const user = await requireSeller();
  const back = safeNext(text(formData, "next"));
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id || product.status !== "draft") redirect(back);
  const copy = duplicateProduct(product.id, newId("prd"));
  if (!copy) redirect(back);
  updateTag(sellerTag(user.publicId));
  updateTag(productTag(user.publicId, copy.slug));
  redirect(back);
}

export async function duplicateTwig(formData: FormData) {
  await requireAdmin();
  const product = getProductById(text(formData, "id"));
  if (!product) redirect("/admin/twigs");
  const copy = duplicateProduct(product.id, newId("prd"));
  const seller = findUserById(product.userId);
  if (seller) updateTag(sellerTag(seller.publicId));
  if (copy && seller) updateTag(productTag(seller.publicId, copy.slug));
  redirect("/admin/twigs");
}

export async function adminDeleteTwig(formData: FormData) {
  await requireAdmin();
  const product = getProductById(text(formData, "id"));
  if (!product) redirect("/admin/twigs");
  const seller = findUserById(product.userId);
  if (!adminDeleteProduct(product.id)) redirect("/admin/twigs");
  if (seller) {
    updateTag(productTag(seller.publicId, product.slug));
    updateTag(sellerTag(seller.publicId));
  }
  redirect("/admin/twigs");
}

export async function adminSetTwig(formData: FormData) {
  await requireAdmin();
  const product = getProductById(text(formData, "id"));
  if (!product) redirect("/admin/twigs");
  const mode = text(formData, "mode");
  if (mode === "deactivate" && product.status === "published") deactivateNow(product.id, product.userId);
  if (mode === "reactivate") {
    if (product.status === "deactivated") reactivateProduct(product.id, product.userId);
    else if (product.status === "published") clearDeactivatesAt(product.id, product.userId);
  }
  const seller = findUserById(product.userId);
  if (seller) {
    updateTag(productTag(seller.publicId, product.slug));
    updateTag(sellerTag(seller.publicId));
  }
  redirect("/admin/twigs");
}

export async function startSellerPayout(formData: FormData) {
  return recordMoneyAction(formData, startPayout);
}

export async function completeSellerPayout(formData: FormData) {
  return recordMoneyAction(formData, completePayout);
}

export async function openOrderDispute(formData: FormData) {
  return recordMoneyAction(formData, (id) => setDispute(id, true));
}

export async function closeOrderDispute(formData: FormData) {
  return recordMoneyAction(formData, (id) => setDispute(id, false));
}

export async function sendOrderFile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const order = getOrder(id);
  const back = `/dashboard/orders/${id}`;
  if (!order || order.sellerId !== user.id) return { next: "/dashboard" };
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  if (!paid || order.fulfillment !== "digital" || order.fileLinks.length === 0) return { next: `${back}?file=wait` };
  const listing = getProductById(order.productId);
  if (twigigiFileHeld(listing, listing ? findUserById(listing.userId) : findUserById(order.sellerId))) return { next: `${back}?file=held` };
  const sent = await deliverPaidFile(id);
  if (!sent) return { next: `${back}?file=mail` };
  markFileSent(id, user.id);
  return { next: `${back}?file=sent` };
}

function ownedQuote(id: string, userId: string) {
  const quote = getQuote(id);
  const product = quote ? getProductById(quote.productId) : null;
  if (!quote || !product || product.userId !== userId) return null;
  return { quote, product };
}

export async function markQuoteContacted(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "id"), user.id);
  if (!owned) return { error: "That quote is not yours." };
  if (owned.quote.status === "closed") return { error: "This request is closed." };
  if (owned.quote.status === "new") updateQuoteStatus(owned.quote.id, user.id, "contacted");
  return { next: `/dashboard/quotes/${owned.quote.id}` };
}

export async function closeQuoteRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "id"), user.id);
  if (!owned) return { error: "That quote is not yours." };
  updateQuoteStatus(owned.quote.id, user.id, "closed");
  return { next: `/dashboard/quotes/${owned.quote.id}` };
}

function followupToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes).toString("base64url");
}

function toolEnabled(productId: string, kind: "visit" | "offer" | "invoice") {
  const settings = readQuoteTwigSettings(productId);
  if (!settings) return kind === "offer";
  if (kind === "visit") return settings.visitEnabled;
  if (kind === "invoice") return settings.invoiceEnabled;
  return settings.offerEnabled;
}

async function deliverFollowup(input: {
  quoteId: string;
  userId: string;
  productId: string;
  customerEmail: string;
  replyTo: string;
  kind: "visit" | "offer" | "invoice";
  payload: Record<string, string | number>;
  subject: string;
  body: string;
  send: boolean;
}) {
  if (!toolEnabled(input.productId, input.kind)) return { error: "Turn on this follow-up tool for the Twig before sending it." };
  const draft = draftQuoteFollowup({
    id: newId("fol"),
    quoteId: input.quoteId,
    userId: input.userId,
    kind: input.kind,
    payload: input.payload,
    token: followupToken(),
  });
  if (!input.send) return { next: `/dashboard/quotes/${input.quoteId}?notice=draft` };
  const saved = quoteFollowups(input.quoteId).find((item) => item.id === draft.id);
  const token = saved?.token || "";
  const mailed = token
    ? await sendOrderEmail(input.customerEmail, {
        subject: input.subject,
        replyTo: input.replyTo,
        text: `${input.body}\n\nOpen it: ${appUrl()}/q/${token}\n`,
      })
    : false;
  if (!mailed) return { next: `/dashboard/quotes/${input.quoteId}?notice=saved` };
  if (sendQuoteFollowup(draft.id)) {
    chargeQuoteFollowup({
      quoteId: input.quoteId,
      userId: input.userId,
      productId: input.productId,
      kind: input.kind,
      billId: newId("bill"),
    });
  }
  return { next: `/dashboard/quotes/${input.quoteId}?notice=sent` };
}

export async function sendSellerQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "id"), user.id);
  if (!owned) return { error: "That quote is not yours." };
  const kind = text(formData, "quoteKind");
  const days = Number(text(formData, "validDays"));
  const scope = text(formData, "scope").trim().slice(0, 2000);
  const note = text(formData, "note").trim().slice(0, 1000);
  const amount = text(formData, "amount").trim();
  const currency = text(formData, "currency") === "USD" ? "USD" : "CAD";
  const fieldErrors: Record<string, string> = {};
  if (kind !== "fixed" && kind !== "estimate") fieldErrors.quoteKind = "Choose a quote type.";
  if (![7, 14, 30].includes(days)) fieldErrors.validDays = "Choose how long this quote stays valid.";
  if (scope.length < 2) fieldErrors.scope = "Describe the scope of work.";
  const amountMatch = amount.match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  const cents = amountMatch ? Number(amountMatch[1]) * 100 + Number((amountMatch[2] ?? "").padEnd(2, "0")) : 0;
  if (!amountMatch || cents < 1) fieldErrors.amount = "Enter an amount.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const result = await deliverFollowup({
    quoteId: owned.quote.id,
    userId: user.id,
    productId: owned.product.id,
    customerEmail: owned.quote.email,
    replyTo: owned.product.contactEmail || user.email,
    kind: "offer",
    payload: { quoteKind: kind, cents, currency, scope, note, validDays: days },
    subject: `Quote for ${owned.product.title}`,
    body: [
      `${user.displayName} sent you a quote for ${owned.product.title}.`,
      "",
      `${kind === "fixed" ? "Fixed price" : "Estimated price"}: ${formatMoney(cents, currency)}`,
      `Valid for ${days} days.`,
      "",
      "Scope of work",
      scope,
      note,
    ].filter(Boolean).join("\n"),
    send: text(formData, "intent") !== "draft",
  });
  if ("error" in result && result.error) return { error: result.error };
  if (result.next?.includes("notice=sent")) {
    saveQuoteOffer(owned.quote.id, user.id, { kind: kind as "fixed" | "estimate", cents, scope, note, timeline: "", validDays: days });
  }
  return result;
}

function goFollowup(quoteId: string, result: { error?: string; next?: string }) {
  if (result.next) redirect(result.next);
  redirect(`/dashboard/quotes/${quoteId}?notice=invalid`);
}

export async function sendSiteVisit(formData: FormData) {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "id"), user.id);
  if (!owned) redirect("/dashboard/quotes");
  const date = text(formData, "visitDate").trim().slice(0, 20);
  const time = text(formData, "visitTime").trim().slice(0, 20);
  const timezone = text(formData, "timezone").trim().slice(0, 80);
  const note = text(formData, "note").trim().slice(0, 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || timezone.length < 2) redirect(`/dashboard/quotes/${owned.quote.id}?notice=invalid`);
  goFollowup(owned.quote.id, await deliverFollowup({
    quoteId: owned.quote.id,
    userId: user.id,
    productId: owned.product.id,
    customerEmail: owned.quote.email,
    replyTo: owned.product.contactEmail || user.email,
    kind: "visit",
    payload: { date, time, timezone, note },
    subject: `Site visit for ${owned.product.title}`,
    body: [
      `${user.displayName} asked to schedule a site visit for ${owned.product.title}.`,
      "",
      `Date: ${date}`,
      `Time: ${time}`,
      `Time zone: ${timezone}`,
      note,
      "",
      "Use the link to confirm this time or ask for a different one.",
    ].filter(Boolean).join("\n"),
    send: text(formData, "intent") !== "draft",
  }));
}

export async function sendQuoteInvoice(formData: FormData) {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "id"), user.id);
  if (!owned) redirect("/dashboard/quotes");
  const amount = text(formData, "amount").trim();
  const currency = text(formData, "currency") === "USD" ? "USD" : "CAD";
  const dueOn = text(formData, "dueOn").trim().slice(0, 20);
  const note = text(formData, "note").trim().slice(0, 1000);
  const amountMatch = amount.match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  const cents = amountMatch ? Number(amountMatch[1]) * 100 + Number((amountMatch[2] ?? "").padEnd(2, "0")) : 0;
  if (!amountMatch || cents < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || note.length < 2) {
    redirect(`/dashboard/quotes/${owned.quote.id}?notice=invalid`);
  }
  goFollowup(owned.quote.id, await deliverFollowup({
    quoteId: owned.quote.id,
    userId: user.id,
    productId: owned.product.id,
    customerEmail: owned.quote.email,
    replyTo: owned.product.contactEmail || user.email,
    kind: "invoice",
    payload: { cents, currency, dueOn, note },
    subject: `Invoice for ${owned.product.title}`,
    body: [
      `${user.displayName} sent an invoice for ${owned.product.title}.`,
      "",
      `Amount: ${formatMoney(cents, currency)}`,
      `Due: ${dueOn}`,
      "",
      "Payment",
      note,
    ].join("\n"),
    send: text(formData, "intent") !== "draft",
  }));
}

export async function markQuoteInvoicePaid(formData: FormData) {
  const user = await requireSeller();
  const owned = ownedQuote(text(formData, "quoteId"), user.id);
  if (!owned) redirect("/dashboard/quotes");
  payQuoteInvoice(text(formData, "id"), user.id);
  redirect(`/dashboard/quotes/${owned.quote.id}?notice=paid`);
}

export async function respondToFollowup(formData: FormData) {
  const token = text(formData, "token");
  const choice = text(formData, "choice");
  const followup = quoteFollowupByToken(token);
  const allowed = followup?.kind === "visit"
    ? choice === "confirmed" || choice === "reschedule"
    : followup?.kind === "offer"
      ? choice === "accepted" || choice === "changes"
      : false;
  if (!followup || followup.status !== "sent" || !allowed) redirect(`/q/${encodeURIComponent(token)}?notice=closed`);
  if (followup.kind === "offer" && choice === "accepted") {
    const latest = quoteFollowups(followup.quoteId).filter((item) => item.kind === "offer" && item.status === "sent");
    const current = latest[latest.length - 1];
    if (!current || current.id !== followup.id) redirect(`/q/${encodeURIComponent(token)}?notice=closed`);
    const days = Number(followup.payload.validDays || 0);
    const sent = Date.parse(followup.sentAt);
    if (Number.isFinite(sent) && days > 0 && Date.now() > sent + days * 86_400_000) redirect(`/q/${encodeURIComponent(token)}?notice=expired`);
  }
  answerQuoteFollowup(token, choice);
  redirect(`/q/${encodeURIComponent(token)}?notice=${choice}`);
}

export async function setLeadStatus(formData: FormData) {
  const user = await requireSeller();
  const kind = text(formData, "kind");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (kind === "order" && ["unpaid", "paid", "fulfilled", "canceled"].includes(status)) {
    const result = updateOrderStatus(id, user.id, status as OrderStatus);
    if (result.justPaid) await sendPaymentConfirmed(id);
  } else if (kind === "quote" && ["new", "contacted", "closed"].includes(status)) {
    updateQuoteStatus(id, user.id, status as "new" | "contacted" | "closed");
  } else if (kind === "message" && ["new", "read", "closed"].includes(status)) {
    updateMessageStatus(id, user.id, status as "new" | "read" | "closed");
  }
}

function reportListingMatch(contentUrl: string, productId: string) {
  const fromUrl = findListingByPath(contentUrl);
  if (fromUrl) return fromUrl;
  if (!productId) return null;
  const product = getProductById(productId);
  if (!product) return null;
  const owner = findUserById(product.userId);
  return owner
    ? { id: product.id, userId: product.userId, title: product.title, slug: product.slug, publicId: owner.publicId, displayName: owner.displayName, email: owner.email }
    : null;
}

export async function submitIpReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name").trim().slice(0, 120);
  const email = text(formData, "email").trim().slice(0, 120);
  const rightType = text(formData, "rightType");
  const protectedWork = text(formData, "protectedWork").trim().slice(0, 2000);
  const contentUrl = text(formData, "contentUrl").trim().slice(0, 500);
  const description = text(formData, "description").trim().slice(0, 4000);
  const signature = text(formData, "signature").trim().slice(0, 120);
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Enter your full name.";
  if (!z.string().email().safeParse(email).success) fieldErrors.email = "Enter a valid email.";
  if (!RIGHT_TYPES.some((item) => item.id === rightType)) fieldErrors.rightType = "Choose the type of right.";
  const rightsHolder = text(formData, "rightsHolder").trim().slice(0, 160);
  const relationship = text(formData, "relationship");
  if (rightsHolder.length < 2) fieldErrors.rightsHolder = "Enter the rights holder's name.";
  if (relationship !== "owner" && relationship !== "agent") fieldErrors.relationship = "Say whether you are the rights holder or authorized to act for them.";
  if (protectedWork.length < 4) fieldErrors.protectedWork = "Identify the protected work or right.";
  if (contentUrl.length < 2) fieldErrors.contentUrl = "Add the listing or content URL.";
  if (description.length < 8) fieldErrors.description = "Describe the alleged infringement.";
  if (text(formData, "accurate") !== "yes") fieldErrors.accurate = "Confirm that the report is accurate.";
  if (signature.length < 2) fieldErrors.signature = "Type your legal name.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const user = await getCurrentUser();
  const listing = findListingByPath(contentUrl);
  insertContentReport({
    kind: "ip",
    reporterUserId: user?.id ?? null,
    reporterName: name,
    reporterEmail: email,
    company: text(formData, "company").trim().slice(0, 160),
    reason: "ip",
    rightType,
    protectedWork,
    contentUrl,
    productId: listing?.id ?? null,
    ownerUserId: listing?.userId ?? null,
    description,
    evidence: text(formData, "evidence").trim().slice(0, 4000),
    signature,
    policyVersion: COPYRIGHT_POLICY_VERSION,
    rightsHolder,
    relationship,
  });
  return { saved: true };
}

export async function submitListingReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name").trim().slice(0, 120);
  const email = text(formData, "email").trim().slice(0, 120);
  const reason = text(formData, "reason");
  const description = text(formData, "description").trim().slice(0, 4000);
  const fieldErrors: Record<string, string> = {};
  if (!LISTING_REPORT_REASONS.some((item) => item.id === reason)) fieldErrors.reason = "Choose a reason.";
  if (name.length < 2) fieldErrors.name = "Enter your name.";
  if (!z.string().email().safeParse(email).success) fieldErrors.email = "Enter a valid email.";
  if (description.length < 8) fieldErrors.description = "Describe what Twigigi should review.";
  if (text(formData, "accurate") !== "yes") fieldErrors.accurate = "Confirm that the report is accurate.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const user = await getCurrentUser();
  const listing = reportListingMatch(text(formData, "contentUrl"), text(formData, "productId"));
  insertContentReport({
    kind: "listing",
    reporterUserId: user?.id ?? null,
    reporterName: name,
    reporterEmail: email,
    company: "",
    reason,
    rightType: "",
    protectedWork: "",
    contentUrl: text(formData, "contentUrl").trim().slice(0, 500),
    productId: listing?.id ?? null,
    ownerUserId: listing?.userId ?? null,
    description,
    evidence: "",
    signature: name,
    policyVersion: TERMS_VERSION,
  });
  return { saved: true };
}

function refreshListing(productId: string) {
  const product = getProductById(productId);
  if (!product) return;
  const seller = findUserById(product.userId);
  if (!seller) return;
  updateTag(productTag(seller.publicId, product.slug));
  updateTag(sellerTag(seller.publicId));
}

export async function adminUpdateReport(formData: FormData) {
  const admin = await requireAdmin();
  const report = getContentReport(text(formData, "id"));
  if (!report) redirect("/admin/reports");
  const status = text(formData, "status");
  if (!REPORT_STATUSES.some((item) => item === status)) redirect(`/admin/reports/${report.id}`);
  const note = text(formData, "adminNote").trim().slice(0, 2000);
  const updated = updateContentReport(report.id, { status, adminNote: note });
  insertModerationEvent({
    actorId: admin.id,
    action: "report_status",
    targetKind: "report",
    targetId: report.id,
    note,
    fromStatus: updated?.fromStatus ?? report.status,
    toStatus: status,
  });
  if (status === "content_restricted" && report.productId) {
    setProductModeration(report.productId, "restricted");
    insertModerationEvent({
      actorId: admin.id,
      action: "restrict_listing",
      targetKind: "product",
      targetId: report.productId,
      note: `Restricted from report ${report.id}`,
      toStatus: "restricted",
    });
    refreshListing(report.productId);
  }
  redirect(`/admin/reports/${report.id}`);
}

export async function adminRestoreReportedListing(formData: FormData) {
  const admin = await requireAdmin();
  const productId = text(formData, "productId");
  const reportId = text(formData, "reportId");
  if (!getProductById(productId)) redirect(reportId ? `/admin/reports/${reportId}` : "/admin/reports");
  setProductModeration(productId, "");
  insertModerationEvent({
    actorId: admin.id,
    action: "restore_listing",
    targetKind: "product",
    targetId: productId,
    note: text(formData, "note").trim().slice(0, 500),
    toStatus: "restored",
  });
  refreshListing(productId);
  redirect(reportId ? `/admin/reports/${reportId}` : "/admin/twigs");
}

export async function adminSuspendAccount(formData: FormData) {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  const reportId = text(formData, "reportId");
  const next = reportId ? `/admin/reports/${reportId}` : "/admin/users";
  const person = findUserById(userId);
  if (!person || person.id === admin.id || person.role === "admin") redirect(next);
  const suspend = text(formData, "suspended") === "1";
  if (!suspend && person.banned) redirect(next);
  setUserSuspended(userId, suspend);
  insertModerationEvent({
    actorId: admin.id,
    action: suspend ? "suspend_user" : "unsuspend_user",
    targetKind: "user",
    targetId: userId,
    note: text(formData, "note").trim().slice(0, 500),
    toStatus: suspend ? "suspended" : "active",
  });
  redirect(next);
}

export async function adminCopyrightAction(formData: FormData) {
  const admin = await requireAdmin();
  const actionName = text(formData, "action");
  const reportId = text(formData, "reportId");
  const back = reportId ? `/admin/reports/${reportId}` : "/admin/reports";
  if (!ENFORCEMENT_ACTIONS.includes(actionName as EnforcementAction)) redirect(back);
  const reason = text(formData, "reason").trim().slice(0, 1000);
  if (reason.length < 4) redirect(back);
  if (enforcementNeedsConfirm(actionName) && text(formData, "confirm") !== "yes") redirect(back);
  const product = getProductById(text(formData, "productId"));
  const person = findUserById(text(formData, "userId") || product?.userId || "");
  if (person && (person.id === admin.id || person.role === "admin") && ["suspend", "unsuspend", "ban", "unban", "restrict_publishing", "restore_publishing"].includes(actionName)) redirect(back);
  const deadline = actionName === "request_documents" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
  if (actionName === "restrict_listing" && product) setProductModeration(product.id, "restricted");
  if (actionName === "restore_listing" && product) setProductModeration(product.id, "");
  if (actionName === "restrict_files" && product) setProductFileAccess(product.id, "restricted");
  if (actionName === "restore_files" && product) setProductFileAccess(product.id, "");
  if (actionName === "restrict_publishing" && person) setUserPublishRestricted(person.id, true);
  if (actionName === "restore_publishing" && person) setUserPublishRestricted(person.id, false);
  if (actionName === "suspend" && person) setUserSuspended(person.id, true);
  if (actionName === "unsuspend" && person && !person.banned) setUserSuspended(person.id, false);
  if (actionName === "ban" && person) setUserBanned(person.id, true);
  if (actionName === "unban" && person) setUserBanned(person.id, false);
  const notice = enforcementNotice({ productTitle: product?.title ?? "", actionLabel: enforcementLabel(actionName), reason, deadline });
  insertModerationEvent({
    actorId: admin.id,
    action: actionName,
    targetKind: product ? "product" : "user",
    targetId: product?.id || person?.id || reportId || "none",
    note: notice,
    toStatus: actionName,
  });
  if (person) {
    insertSellerNotice({ userId: person.id, productId: product?.id, kind: actionName, body: notice, deadline: deadline ?? "" });
    await sendOrderEmail(person.email, { subject: `Twigigi: ${enforcementLabel(actionName)}`, text: notice });
  }
  if (product) refreshListing(product.id);
  redirect(back);
}

export async function submitCopyrightAppeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const statement = text(formData, "statement").trim().slice(0, 4000);
  const evidence = text(formData, "evidence").trim().slice(0, 4000);
  const productId = text(formData, "productId");
  const fieldErrors: Record<string, string> = {};
  if (statement.length < 8) fieldErrors.statement = "Explain why the action should be reviewed.";
  const product = productId ? getProductById(productId) : null;
  if (productId && (!product || product.userId !== user.id)) fieldErrors.productId = "Choose one of your Twigs.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  insertCopyrightAppeal({ userId: user.id, productId: product?.id ?? "", statement, evidence });
  insertModerationEvent({
    actorId: user.id,
    action: "appeal_submitted",
    targetKind: product ? "product" : "user",
    targetId: product?.id || user.id,
    note: statement.slice(0, 500),
    toStatus: "submitted",
  });
  return { saved: true };
}

export async function adminReviewAppeal(formData: FormData) {
  const admin = await requireAdmin();
  const appealId = text(formData, "id");
  if (!getCopyrightAppeal(appealId)) redirect("/admin/appeals");
  const status = text(formData, "status") === "reviewed" ? "reviewed" : "submitted";
  const note = text(formData, "adminNote").trim().slice(0, 2000);
  updateCopyrightAppeal(appealId, status, note);
  insertModerationEvent({
    actorId: admin.id,
    action: "appeal_review",
    targetKind: "appeal",
    targetId: appealId,
    note,
    toStatus: status,
  });
  redirect(`/admin/appeals/${appealId}`);
}
