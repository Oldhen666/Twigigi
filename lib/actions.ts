"use server";

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { placeProblem, splitLocation } from "@/lib/places";
import { cardLinkProblem, digitalPayProblem, interacEmailProblem, isTransferMethod, methodLabel, methodsForFulfillment, parsePaymentMethods, paypalMeName, paypalMeProblem, sellerContactProblem, venmoUsernameProblem, zelleContactProblem } from "@/lib/payments";
import { clearSession, getCurrentUser, getImpersonation, requireAdmin, requireSeller, requireUser, setSession } from "@/lib/auth";
import { productTag, sellerTag } from "@/lib/catalog";
import { deliverPaidFile, sendPaymentConfirmed } from "@/lib/file-delivery";
import { acceptNote, notifyBuyer, readyNote } from "@/lib/order-notices";
import { fulfillmentDone, shipsToBuyer } from "@/lib/order-flow";
import { parseFileLinks } from "@/lib/files";
import { resolveUpload, uploadDirectory } from "@/lib/uploads";
import {
  claimBuyerOrders,
  createUser,
  clearDeactivatesAt,
  clearDeactivatedAt,
  deleteProduct,
  confirmListingRights,
  findListingByPath,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  getOrder,
  getProductById,
  insertContentReport,
  insertModerationEvent,
  insertMessage,
  insertOrder,
  insertProduct,
  insertQuote,
  insertReview,
  openInteraction,
  confirmInteractionParty,
  adminSetConfirmation,
  updateReview,
  deleteReview,
  reviewPlacement,
  updateContentReport,
  updateDisplayName,
  getContentReport,
  getInteraction,
  getInteractionBySource,
  productHasActivity,
  recordLegalAcceptance,
  releaseStock,
  reserveStock,
  setOrderChoices,
  setInteracPrompt,
  sellerReviewOrder,
  acceptOrderProposal,
  confirmOrderPaymentReceived,
  markOrderFulfillment,
  confirmBuyerReceipt,
  completeSellerOrder,
  deactivateNow,
  resumePublished,
  publishDraft,
  setProductModeration,
  setUserSuspended,
  setBillingMethod,
  setPayoutDetails,
  setBillingStarted,
  setListingFeeExempt,
  recordTwigBill,
  reactivateProduct,
  replacePasswordReset,
  takePasswordReset,
  toggleFavorite,
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
  startPayout,
  updateOrderStatus,
  updateProduct,
  updateQuoteStatus,
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
import { IP_POLICY_VERSION, LISTING_REPORT_REASONS, PRIVACY_VERSION, REPORT_STATUSES, RIGHT_TYPES, TERMS_VERSION } from "@/lib/legal";
import { sendOrderEmail, sendResetEmail } from "@/lib/mail";
import { ensureVisitor } from "@/lib/visitor";
import { activeWindow, billingCurrency, isBillingMethod, listingFeeCents, listingFeeCurrency, listingStillPaid, QUOTE_SUBMISSION_CENTS } from "@/lib/billing";
import { normalizeQuoteForm } from "@/lib/quote-form";
import { getStripe } from "@/lib/stripe";
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

async function createSellerAccount(formData: FormData): Promise<OpenedAccount> {
  const parsed = signupSchema.safeParse({
    displayName: text(formData, "displayName"),
    username: text(formData, "username"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
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
  const parsed = signupSchema.safeParse({
    displayName: text(formData, "displayName"),
    username: text(formData, "username"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
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
  const id = text(formData, "id");
  const existing = id ? getProductById(id) : null;

  const intent = text(formData, "intent") === "publish" ? "publish" : "draft";
  const errors: Record<string, string> = {};
  const title = text(formData, "title").trim();
  const description = text(formData, "description").trim();
  const location = text(formData, "location").trim();
  const ctaValue = text(formData, "cta");
  const cta: Cta = ctaValue === "buy" || ctaValue === "contact" || ctaValue === "file" ? ctaValue : "quote";
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
  if (description.length > 2000) {
    errors.description = `Keep the description under 2,000 characters (${description.length.toLocaleString("en-US")} so far).`;
  } else if (description.length < 10) {
    const remaining = 10 - description.length;
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
  const paymentMethods = cta === "file" ? ["card"] : priced ? parsePaymentMethods(text(formData, "paymentMethods"), payCountry) : [];
  const cardPaymentUrl = text(formData, "cardPaymentUrl").trim().slice(0, 500);
  const interacEmail = text(formData, "interacEmail").trim().slice(0, 80);
  const interacQuestion = text(formData, "interacQuestion").trim().slice(0, 120);
  const interacPassword = text(formData, "interacPassword").trim().slice(0, 80);
  const venmoUsername = text(formData, "venmoUsername").trim().replace(/^@/, "").slice(0, 30);
  const paypalRaw = text(formData, "paypalMe").trim().slice(0, 200);
  const paypalName = paypalMeName(paypalRaw);
  const paypalMe = paypalName ? `https://paypal.me/${paypalName}` : paypalRaw;
  const zelleMode = text(formData, "zelleMode") === "email" ? "email" : "phone";
  const zelleContact = text(formData, "zelleContact").trim().slice(0, 80);
  const sellerContactMode = text(formData, "sellerContactMode") === "phone" ? "phone" : "email";
  const sellerContact = text(formData, "sellerContact").trim().slice(0, 80);
  if (priced && intent === "publish") {
    if (cta !== "file" && paymentMethods.length === 0) {
      errors.paymentMethods = payCountry ? "Choose at least one way buyers can pay." : "Choose a country before choosing how buyers pay.";
    }
    if (cta === "file") {
      const problem = digitalPayProblem(cardPaymentUrl, text(formData, "digitalPayMode"));
      if (problem) errors.cardPaymentUrl = problem;
    } else if (paymentMethods.includes("card")) {
      const problem = cardLinkProblem(cardPaymentUrl);
      if (problem) errors.cardPaymentUrl = problem;
    }
    if (paymentMethods.includes("interac")) {
      const problem = interacEmailProblem(interacEmail);
      if (problem) errors.interacEmail = problem;
    }
    if (paymentMethods.includes("venmo")) {
      const problem = venmoUsernameProblem(venmoUsername);
      if (problem) errors.venmoUsername = problem;
    }
    if (paymentMethods.includes("paypal")) {
      const problem = paypalMeProblem(paypalRaw);
      if (problem) errors.paypalMe = problem;
    }
    if (paymentMethods.includes("zelle")) {
      const problem = zelleContactProblem(zelleMode, zelleContact);
      if (problem) errors.zelleContact = problem;
    }
    if ((shippingEnabled || deliveryEnabled) && !paymentMethods.some((id) => isTransferMethod(id))) {
      errors.paymentMethods = "Add a transfer method for delivery and shipping, such as Interac, PayPal, Venmo, or Zelle.";
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
    if (text(formData, "contentRights") !== "yes") {
      errors.contentRights = "Confirm that you own or have permission to use the content in this listing.";
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

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
  if (existing && existing.status !== "draft" && intent === "draft") {
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

  const requestedSlug = slugify(text(formData, "slug") || title);
  const slug = uniqueSlug(owner.id, requestedSlug, existing?.id);
  const input: ProductInput = {
    slug,
    title,
    brand: cta === "contact" ? "" : text(formData, "brand").trim().slice(0, 80),
    categoryKind: chosenCategory?.kind === "service" ? "service" : chosenCategory ? "product" : "",
    categoryGroup: chosenCategory?.groupId ?? "",
    category: chosenCategory?.itemId ?? "",
    description,
    priceCents: typeof price === "number" ? price : null,
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
    status: intent === "publish" ? "published" : "draft",
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
    paypalMe: paymentMethods.includes("paypal") ? paypalMe : "",
    zelleMode,
    zelleContact,
    sellerContactMode: priced ? sellerContactMode : "email",
    sellerContact: priced ? sellerContact : "",
    fileLinks: parsedLinks.links,
    filePassword,
  };

  const savedProductId = existing?.id ?? newId("prd");
  const needsBilling = intent === "publish" && !adminEdit && !acting && !existing?.feeExempt && !user.billingMethod;
  if (needsBilling) input.status = "draft";
  try {
    if (existing) {
      updateProduct(existing.id, owner.id, input);
      if (input.status !== "published" || existing.status === "deactivated") clearDeactivatesAt(existing.id, owner.id);
      if (input.status === "published" && existing.status === "deactivated") clearDeactivatedAt(existing.id, owner.id);
    } else insertProduct(savedProductId, owner.id, input);
    if (input.status === "published") confirmListingRights(savedProductId, owner.id, TERMS_VERSION, IP_POLICY_VERSION);
  } catch {
    return { error: "Could not save this Twig. Try a different link name.", ...sessionStamp };
  }

  if (existing && existing.slug !== slug) updateTag(productTag(owner.publicId, existing.slug));
  updateTag(productTag(owner.publicId, slug));
  updateTag(sellerTag(owner.publicId));

  if (needsBilling) redirect(`/billing?next=${encodeURIComponent(`/dashboard/products/${savedProductId}`)}`);
  if (input.status === "published" && (!existing || existing.status !== "published")) {
    setBillingStarted(savedProductId, owner.id);
    const cents = listingFeeCents(input.cta, Boolean(existing?.feeExempt));
    if (cents && user.billingMethod && !acting) {
      const window = activeWindow(new Date().toISOString());
      recordTwigBill({
        id: newId("bill"),
        userId: owner.id,
        productId: savedProductId,
        amountCents: cents,
        currency: listingFeeCurrency(input.cta, location),
        method: user.billingMethod,
        kind: "listing",
        periodStart: window.start,
        periodEnd: window.end,
        status: "recorded",
      });
    }
  }
  if (input.status === "published") redirect(`/${owner.publicId}/${slug}`);
  if (existing?.status === "published") redirect(`/dashboard/products/${savedProductId}?saved=1`);
  return { saved: true, productId: savedProductId, slug, images, savedAt: Date.now() };
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

export async function savePayoutDetails(formData: FormData) {
  const user = await requireSeller();
  const clip = (key: string, max: number) => text(formData, key).trim().slice(0, max);
  setPayoutDetails(user.id, {
    interac: clip("interac", 120),
    venmo: clip("venmo", 80),
    zelle: clip("zelle", 120),
  });
  redirect("/dashboard/payments");
}

export async function saveBillingMethod(formData: FormData) {
  const user = await requireSeller();
  const method = text(formData, "method");
  if (!isBillingMethod(method)) redirect("/billing");
  setBillingMethod(user.id, method);
  redirect(safeNext(text(formData, "next")));
}

export async function payAndPublish(formData: FormData) {
  const user = await requireSeller();
  const acting = await getImpersonation();
  const product = getProductById(text(formData, "id"));
  const back = safeNext(text(formData, "next"));
  if (!product || product.userId !== user.id || product.status === "published") redirect(back);
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
  const currency = listingFeeCurrency(product.cta, product.location);
  const stripe = getStripe();
  if (stripe && cents && (user.billingMethod === "card" || user.billingMethod === "stripe")) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: cents,
            product_data: { name: `Twigigi · ${product.title}` },
          },
        },
      ],
      success_url: `${appUrl()}/billing/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/dashboard`,
      metadata: { purpose: "twig", userId: user.id, productId: product.id },
    });
    if (session.url) redirect(session.url);
  }
  if (product.status === "deactivated") reactivateProduct(product.id, user.id);
  else publishDraft(product.id, user.id);
  if (cents) {
    const window = activeWindow(new Date().toISOString());
    recordTwigBill({
      id: newId("bill"),
      userId: user.id,
      productId: product.id,
      amountCents: cents,
      currency,
      method: user.billingMethod,
      kind: "listing",
      periodStart: window.start,
      periodEnd: window.end,
      status: "recorded",
    });
  }
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

function chosenOrderDetails(formData: FormData, fulfillment: string, methods: string[], schedules: string[]):
  { ok: false; fieldErrors: Record<string, string> } | { ok: true; payment: string; pickupWindow: string } {
  const payment = text(formData, "paymentMethod");
  if (methods.length > 0 && !methods.includes(payment)) {
    return { ok: false, fieldErrors: { paymentMethod: "Choose how you will pay." } };
  }
  if (fulfillment === "pickup") {
    const problem = pickupChoiceProblem(schedules, text(formData, "pickupTime"));
    if (problem) return { ok: false, fieldErrors: { pickupTime: problem } };
  }
  return {
    ok: true,
    payment: methods.includes(payment) ? payment : "",
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

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = text(formData, "productId");
  const product = getProductById(productId);
  if (!product || !isTwigLive(product) || product.priceCents == null || (product.cta !== "buy" && product.cta !== "file")) {
    return { error: "This Twig is not available to buy." };
  }
  if (product.cta === "file" && product.fileLinks.length === 0) return { error: "This file is not ready yet." };
  if (product.quantityAvailable === 0) return { error: "This product is sold out." };

  const digital = product.cta === "file";
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
  const payFulfillment = parsed.data.fulfillment === "delivery" || parsed.data.fulfillment === "shipping" ? parsed.data.fulfillment : "pickup";
  const payMethods = digital ? ["card"] : methodsForFulfillment(product.paymentMethods, payFulfillment);
  const schedules = parsed.data.fulfillment === "pickup" ? [product.pickupTime] : [];
  const choice = chosenOrderDetails(formData, parsed.data.fulfillment, payMethods, schedules);
  if (!choice.ok) return { fieldErrors: choice.fieldErrors };
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
      `Buyer: ${parsed.data.name}`,
      `Email: ${parsed.data.email}`,
      parsed.data.phone ? `Phone: ${parsed.data.phone}` : null,
      `Quantity: ${parsed.data.quantity}`,
      digital ? "Delivery: emailed after you mark the order paid" : `Fulfillment: ${parsed.data.fulfillment}`,
      parsed.data.fulfillment === "pickup" && product.pickupNote.trim() ? `Pickup location: ${product.pickupNote.trim()}` : null,
      choice.pickupWindow ? `Pickup time: ${formatPickupChoice(choice.pickupWindow)}` : null,
      !digital && parsed.data.fulfillment !== "pickup" && parsed.data.address ? `Address: ${parsed.data.address}` : null,
      instructions.note ? `Delivery instructions: ${instructions.note}` : null,
      choice.payment ? `Payment: ${methodLabel(choice.payment)}` : null,
      `Total: ${formatMoney(total, product.currency)}`,
      order?.publicRef ? `Order: ${order.publicRef}` : null,
      "Accept the order, propose a change, or decline it from the order page.",
      digital ? "After the money arrives, confirm the payment, then email the file link from the order page." : null,
      "",
      `Open the order: ${appUrl()}/dashboard/orders/${orderId}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New order: ${product.title}`, text: lines.join("\n"), replyTo: parsed.data.email });
  }

  redirect(`/order/${orderId}`);
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
  if (fulfillment !== "pickup" && parsed.data.address.length < 4) {
    return { fieldErrors: { address: "Enter an address for delivery or shipping." } };
  }
  const schedules = fulfillment === "pickup" ? prepared.map((line) => line.product.pickupTime) : [];
  const choice = chosenOrderDetails(formData, fulfillment, sharedMethods, schedules);
  if (!choice.ok) return { fieldErrors: choice.fieldErrors };
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
      "Accept the order, propose a change, or decline it from the order page.",
      "",
      `Open the order: ${appUrl()}/dashboard/orders/${orderId}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New order from ${parsed.data.name}`, text: text.join("\n"), replyTo: parsed.data.email });
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
  insertQuote({
    id,
    productId: product.id,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
    quantity: Math.max(quantity, 1),
    projectDetails: lines.join("\n").slice(0, 2000),
    documents,
    src: await trafficSource(),
  });
  const quoteSeller = findUserById(product.userId);
  const quotedAt = new Date().toISOString();
  recordTwigBill({
    id: newId("bill"),
    userId: product.userId,
    productId: product.id,
    amountCents: QUOTE_SUBMISSION_CENTS,
    currency: billingCurrency(product.location),
    method: quoteSeller?.billingMethod || "",
    kind: "quote",
    periodStart: quotedAt,
    periodEnd: quotedAt,
    status: "recorded",
  });
  openInteraction({
    kind: "quote",
    sourceId: id,
    productId: product.id,
    sellerId: product.userId,
    buyerId: sessionUser?.id ?? emailMatch?.id ?? null,
    buyerEmail: parsed.data.email,
  });
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
  const sent = await notifyBuyer(updated, `Order confirmed: ${updated.productTitle}`, acceptNote(updated, product?.interacEmail ?? "", product?.paypalMe ?? ""));
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
    await notifyBuyer(next, `Order confirmed: ${next.productTitle}`, acceptNote(next, product?.interacEmail ?? "", product?.paypalMe ?? ""));
  }
  redirect(back);
}

export async function confirmOrderPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSeller();
  const id = text(formData, "id");
  const back = `/dashboard/orders/${id}`;
  if (!confirmOrderPaymentReceived(id, user.id)) return { next: back };
  const order = getOrder(id);
  if (!order) return { next: back };
  const sent = order.fulfillment === "digital"
    ? await sendPaymentConfirmed(id)
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
  if (!markOrderFulfillment(id, user.id, state)) return { next: back };
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
    if (notify.length > 0) {
      await sendOrderEmail(notify, {
        subject: `Receipt confirmed: ${order.productTitle}`,
        text: [`${order.buyerName} confirmed receipt of order ${order.publicRef}.`, "You can mark the order complete.", "", `${appUrl()}/dashboard/orders/${order.id}`].join("\n"),
        replyTo: order.email,
      });
    }
  }
  redirect(back);
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

export async function updateAccountUsername(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const claimed = claimPublicUsername(user.id, text(formData, "username"));
  if (claimed.fieldErrors || claimed.error) return claimed;
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
  const sent = await deliverPaidFile(id);
  if (!sent) return { next: `${back}?file=mail` };
  markFileSent(id, user.id);
  return { next: `${back}?file=sent` };
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
    policyVersion: IP_POLICY_VERSION,
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
