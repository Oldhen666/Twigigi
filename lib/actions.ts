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
import { cardLinkProblem, interacEmailProblem, isTransferMethod, methodsForFulfillment, parsePaymentMethods, sellerContactProblem, venmoUsernameProblem, zelleContactProblem } from "@/lib/payments";
import { clearSession, getCurrentUser, requireAdmin, requireSeller, setSession } from "@/lib/auth";
import { productTag, sellerTag } from "@/lib/catalog";
import {
  claimBuyerOrders,
  createUser,
  clearDeactivatesAt,
  clearDeactivatedAt,
  deleteProduct,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  getOrder,
  getProductById,
  insertMessage,
  insertOrder,
  insertProduct,
  insertQuote,
  productHasActivity,
  releaseStock,
  reserveStock,
  setDeactivatesAt,
  reactivateProduct,
  replacePasswordReset,
  takePasswordReset,
  uniqueSlug,
  updatePassword,
  updateMessageStatus,
  completePayout,
  setDispute,
  startPayout,
  updateOrderStatus,
  updateProduct,
  updateQuoteStatus,
} from "@/lib/db";
import {
  appUrl,
  formatMoney,
  fulfillmentOptions,
  isTwigLive,
  nextBillingDate,
  normalizeSrc,
  orderAmount,
  readCta,
  RESERVED_USERNAMES,
  safeNext,
  slugify,
  SRC_COOKIE,
} from "@/lib/format";
import type { Cta, FormState, Fulfillment, OrderStatus, ProductInput } from "@/lib/types";
import { sendOrderEmail, sendResetEmail } from "@/lib/mail";
import { normalizeQuoteForm } from "@/lib/quote-form";
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
  if (findUserByUsername(parsed.data.username)) {
    return { fieldErrors: { username: "That username is taken. Each link starts with a unique username." } };
  }
  const id = newId("usr");
  try {
    createUser({
      id,
      email: parsed.data.email,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
      username: parsed.data.username,
      displayName: parsed.data.displayName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users.email")) return { fieldErrors: { email: "An account with that email already exists." } };
    if (message.includes("users.username")) return { fieldErrors: { username: "That username is taken." } };
    return { error: "Could not create the account." };
  }
  const sessionError = await startSession(id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: id };
}

async function createBuyerAccount(formData: FormData): Promise<OpenedAccount> {
  const parsed = z
    .object({
      displayName: signupSchema.shape.displayName,
      email: signupSchema.shape.email,
      password: signupSchema.shape.password,
    })
    .safeParse({
      displayName: text(formData, "displayName"),
      email: text(formData, "email"),
      password: text(formData, "password"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const id = newId("usr");
  const username = `b${randomBytes(6).toString("hex")}`;
  try {
    createUser({
      id,
      email: parsed.data.email,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
      username,
      displayName: parsed.data.displayName,
      role: "buyer",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users.email")) return { fieldErrors: { email: "An account with that email already exists." } };
    return { error: "Could not create the account." };
  }
  claimBuyerOrders(id, parsed.data.email);
  const sessionError = await startSession(id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: id };
}

async function signInAccount(formData: FormData): Promise<OpenedAccount> {
  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return { error: "Email or password is incorrect." };
  }
  const sessionError = await startSession(user.id);
  if (sessionError) return { error: sessionError };
  return { ok: true, userId: user.id };
}

async function openAccount(formData: FormData) {
  if (text(formData, "accountMode") === "login") return signInAccount(formData);
  return createSellerAccount(formData);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const buyer = text(formData, "role") === "buyer";
  const created = buyer ? await createBuyerAccount(formData) : await createSellerAccount(formData);
  if (!created.ok) return created;
  if (buyer) return { next: "/orders" };
  const cta = readCta(text(formData, "cta"));
  return { next: cta ? `/dashboard/products/new?cta=${cta}` : "/start" };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const opened = await signInAccount(formData);
  if (!opened.ok || !opened.userId) return opened;
  const user = findUserById(opened.userId);
  const requested = text(formData, "next");
  if (user?.role === "buyer") {
    claimBuyerOrders(user.id, user.email);
    return { next: !requested || requested === "/dashboard" ? "/orders" : safeNext(requested) };
  }
  return { next: requested ? safeNext(requested) : "/dashboard" };
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
  const user = findUserById(userId);
  return { next: user?.role === "buyer" ? "/orders" : "/dashboard" };
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
  const directory = path.join(process.cwd(), "public", "uploads");
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
  const directory = path.join(process.cwd(), "public", "uploads");
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
  const cta: Cta = ctaValue === "buy" || ctaValue === "contact" ? ctaValue : "quote";
  const price = parseMoney(text(formData, "price"));
  const deliveryRadius = parseWhole(text(formData, "deliveryRadiusKm"));
  const deliveryFee = parseMoney(text(formData, "deliveryFee"));
  const shippingFee = parseMoney(text(formData, "shippingFee"));
  const videoRaw = text(formData, "videoUrl").trim();
  const videoUrl = videoRaw ? cleanHttpUrl(videoRaw) : null;

  if (title.length < 2) errors.title = "Enter a product name.";
  if (title.length > 80) errors.title = "Keep the name under 80 characters.";
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
  const files = formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (kept.length + files.length > 6) errors.images = "Use up to 6 photos.";
  for (const file of files) {
    if (!IMAGE_TYPES[file.type]) errors.images = "Use JPG, PNG, or WebP photos.";
    if (file.size > 5 * 1024 * 1024) errors.images = "Each photo must be under 5 MB.";
  }

  const pickupEnabled = formData.get("pickupEnabled") === "on";
  const deliveryEnabled = formData.get("deliveryEnabled") === "on";
  const shippingEnabled = formData.get("shippingEnabled") === "on";
  const onsiteEnabled = formData.get("onsiteEnabled") === "on";
  const remoteEnabled = formData.get("remoteEnabled") === "on";
  const atLocationEnabled = formData.get("atLocationEnabled") === "on";
  const contactEmail = text(formData, "contactEmail").trim().toLowerCase();
  const contactPhone = text(formData, "contactPhone").trim();

  const buttonLabel = text(formData, "buttonLabel").trim().slice(0, 40) || "Buy now";
  const quantityMode = text(formData, "quantityMode");
  const quantityRaw = parseWhole(text(formData, "quantityAvailable"));
  let quantityAvailable: number | null = null;
  if (cta === "buy" && quantityMode === "limited") {
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

  if (cta === "buy" && price !== "invalid" && (typeof price !== "number" || price < 50)) {
    errors.price = "Enter a price of at least $0.50.";
  }
  if (cta === "buy") {
    const place = placeProblem(location);
    if (place) errors.location = place;
  }
  const payCountry = splitLocation(location).country;
  const paymentMethods = cta === "buy" ? parsePaymentMethods(text(formData, "paymentMethods"), payCountry) : [];
  const cardPaymentUrl = text(formData, "cardPaymentUrl").trim().slice(0, 500);
  const interacEmail = text(formData, "interacEmail").trim().slice(0, 80);
  const venmoUsername = text(formData, "venmoUsername").trim().replace(/^@/, "").slice(0, 30);
  const zelleMode = text(formData, "zelleMode") === "email" ? "email" : "phone";
  const zelleContact = text(formData, "zelleContact").trim().slice(0, 80);
  const sellerContactMode = text(formData, "sellerContactMode") === "phone" ? "phone" : "email";
  const sellerContact = text(formData, "sellerContact").trim().slice(0, 80);
  if (cta === "buy" && intent === "publish") {
    if (paymentMethods.length === 0) {
      errors.paymentMethods = payCountry ? "Choose at least one way buyers can pay." : "Choose a country before choosing how buyers pay.";
    }
    if (paymentMethods.includes("card")) {
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
    if (paymentMethods.includes("zelle")) {
      const problem = zelleContactProblem(zelleMode, zelleContact);
      if (problem) errors.zelleContact = problem;
    }
    if ((shippingEnabled || deliveryEnabled) && !paymentMethods.some((id) => isTransferMethod(id))) {
      errors.paymentMethods = "Add a transfer method for delivery and shipping, such as Interac, Venmo, or Zelle.";
    }
    const contactProblem = sellerContactProblem(sellerContactMode, sellerContact);
    if (contactProblem) errors.sellerContact = contactProblem;
  }

  if (intent === "publish") {
    if (cta !== "buy" && location.length < 2) errors.location = "Add a public location, such as a city.";
    if (kept.length + files.length < 1) errors.images = "Add at least one photo.";
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
  if (user.role === "buyer") {
    return { error: "This account is for buying. Use a seller account to publish a Twig.", ...sessionStamp };
  }
  if (id && (!existing || existing.userId !== user.id)) {
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
    images = [...kept, ...(await saveImages(files))];
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the photos.", ...sessionStamp };
  }

  const requestedSlug = slugify(text(formData, "slug") || title);
  const slug = uniqueSlug(user.id, requestedSlug, existing?.id);
  const input: ProductInput = {
    slug,
    title,
    brand: cta === "contact" ? "" : text(formData, "brand").trim().slice(0, 80),
    description,
    priceCents: typeof price === "number" ? price : null,
    location,
    videoUrl,
    pickupEnabled,
    pickupNote: text(formData, "pickupNote").trim().slice(0, 400),
    pickupTime: text(formData, "pickupTime").trim().slice(0, 480),
    deliveryEnabled,
    deliveryRadiusKm: deliveryEnabled && typeof deliveryRadius === "number" ? deliveryRadius : null,
    deliveryFeeCents: deliveryEnabled && typeof deliveryFee === "number" ? deliveryFee : null,
    shippingEnabled,
    shippingFeeCents: shippingEnabled && typeof shippingFee === "number" ? shippingFee : null,
    shippingNote: text(formData, "shippingNote").trim().slice(0, 400),
    onsiteEnabled,
    remoteEnabled,
    atLocationEnabled,
    cta,
    contactEmail,
    contactPhone: contactPhone.slice(0, 40),
    status: intent === "publish" ? "published" : "draft",
    images,
    quantityAvailable: cta === "buy" ? quantityAvailable : null,
    buttonLabel: cta === "buy" ? buttonLabel : "Buy now",
    hasOptions: cta === "buy" && offer.hasOptions,
    samePrice: cta === "buy" ? offer.samePrice : true,
    options: cta === "buy" ? offer.options : [],
    variants: cta === "buy" && offer.hasOptions ? offer.variants : [],
    requireName: cta !== "buy" || formData.get("requireName") === "on",
    requireEmail: true,
    requirePhone: cta !== "buy" || formData.get("requirePhone") === "on",
    quoteForm: cta === "quote" ? normalizeQuoteForm(readJson(text(formData, "quoteFormJson"))) : null,
    paymentMethods,
    cardPaymentUrl,
    interacEmail,
    venmoUsername,
    zelleMode,
    zelleContact,
    sellerContactMode: cta === "buy" ? sellerContactMode : "email",
    sellerContact: cta === "buy" ? sellerContact : "",
  };

  const savedProductId = existing?.id ?? newId("prd");
  try {
    if (existing) {
      updateProduct(existing.id, user.id, input);
      if (input.status !== "published" || existing.status === "deactivated") clearDeactivatesAt(existing.id, user.id);
      if (input.status === "published" && existing.status === "deactivated") clearDeactivatedAt(existing.id, user.id);
    } else insertProduct(savedProductId, user.id, input);
  } catch {
    return { error: "Could not save this Twig. Try a different link name.", ...sessionStamp };
  }

  if (existing && existing.slug !== slug) updateTag(productTag(user.username, existing.slug));
  updateTag(productTag(user.username, slug));
  updateTag(sellerTag(user.username));

  if (input.status === "published") redirect(`/${user.username}/${slug}`);
  if (existing?.status === "published") redirect(`/dashboard/products/${savedProductId}?saved=1`);
  return { saved: true, productId: savedProductId, slug, images, savedAt: Date.now() };
}

export async function removeProduct(formData: FormData) {
  const user = await requireSeller();
  const id = text(formData, "id");
  const product = getProductById(id);
  if (!product || product.userId !== user.id) redirect("/dashboard");
  if (product.status !== "draft") redirect(`/dashboard/products/${product.id}?blocked=live`);
  if (productHasActivity(product.id)) {
    redirect(`/dashboard/products/${product.id}?blocked=1`);
  }
  deleteProduct(product.id, user.id);
  updateTag(productTag(user.username, product.slug));
  updateTag(sellerTag(user.username));
  redirect("/dashboard");
}

export async function scheduleDeactivation(formData: FormData) {
  const user = await requireSeller();
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id || product.status !== "published") redirect("/dashboard");
  if (!product.deactivatesAt) setDeactivatesAt(product.id, user.id, nextBillingDate());
  updateTag(productTag(user.username, product.slug));
  updateTag(sellerTag(user.username));
  redirect("/dashboard");
}

export async function reactivateTwig(formData: FormData) {
  const user = await requireSeller();
  const product = getProductById(text(formData, "id"));
  if (!product || product.userId !== user.id) redirect("/dashboard");
  if (product.status === "deactivated") reactivateProduct(product.id, user.id);
  else if (product.status === "published") clearDeactivatesAt(product.id, user.id);
  updateTag(productTag(user.username, product.slug));
  updateTag(sellerTag(user.username));
  redirect("/dashboard");
}

const personSchema = {
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().min(7, "Enter a phone number.").max(30),
};

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = text(formData, "productId");
  const product = getProductById(productId);
  if (!product || !isTwigLive(product) || product.cta !== "buy" || product.priceCents == null) {
    return { error: "This Twig is not available to buy." };
  }
  if (product.quantityAvailable === 0) return { error: "This product is sold out." };

  const cap = product.quantityAvailable == null ? 20 : Math.min(20, product.quantityAvailable);
  const parsed = z
    .object({
      name: product.requireName ? personSchema.name : z.string().trim().max(80),
      email: personSchema.email,
      phone: product.requirePhone ? personSchema.phone : z.string().trim().max(30),
      quantity: z.coerce.number().int().min(1).max(Math.max(cap, 1)),
      fulfillment: z.enum(["pickup", "delivery", "shipping"]),
      address: z.string().trim().max(300),
    })
    .safeParse({
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      quantity: text(formData, "quantity") || "1",
      fulfillment: text(formData, "fulfillment"),
      address: text(formData, "address"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.quantity > cap) return { fieldErrors: { quantity: `Only ${cap} available.` } };

  const selection = resolveSelection(product, text(formData, "variant"));
  if (!selection || selection.priceCents == null) return { error: "Choose an available option on the Twig." };
  if (!selection.available) return { error: "That combination is unavailable." };

  const allowed = fulfillmentOptions(product).some((option) => option.id === parsed.data.fulfillment);
  if (!allowed) return { fieldErrors: { fulfillment: "Choose how you want to receive it." } };
  if (parsed.data.fulfillment !== "pickup" && methodsForFulfillment(product.paymentMethods, parsed.data.fulfillment).length === 0) {
    return { error: "Delivery and shipping have to be paid by transfer first. This seller has not set one up." };
  }
  if (parsed.data.fulfillment !== "pickup" && parsed.data.address.length < 4) {
    return { fieldErrors: { address: "Enter an address for delivery or shipping." } };
  }
  const subtotal = selection.priceCents * parsed.data.quantity;
  const amount = orderAmount(selection.priceCents, parsed.data.quantity, parsed.data.fulfillment, product);
  if (amount == null) return { error: "Could not calculate the total." };
  const shipping = amount - subtotal;
  const tax = 0;
  const total = subtotal + shipping + tax;

  if (!reserveStock(product.id, parsed.data.quantity)) return { error: "There aren't enough left." };

  const orderId = newId("ord");
  const sessionUser = await getCurrentUser();
  const emailMatch = findUserByEmail(parsed.data.email);
  const buyerId = sessionUser ? sessionUser.id : emailMatch?.role === "buyer" ? emailMatch.id : null;
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
      address: parsed.data.fulfillment === "pickup" ? "" : parsed.data.address,
      subtotalCents: subtotal,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: total,
      currency: product.currency,
      src: await trafficSource(),
      variantLabel: selection.label,
    });
  } catch {
    if (product.quantityAvailable != null) releaseStock(product.id, parsed.data.quantity);
    return { error: "Could not save this order. Try again." };
  }

  const seller = findUserById(product.userId);
  const reserved = product.contactEmail.trim().toLowerCase();
  const notify = z.string().email().safeParse(reserved).success ? reserved : seller?.email ?? "";
  if (notify) {
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
      `Fulfillment: ${parsed.data.fulfillment}`,
      parsed.data.fulfillment !== "pickup" && parsed.data.address ? `Address: ${parsed.data.address}` : null,
      `Total: ${formatMoney(total, product.currency)}`,
      order?.publicRef ? `Order: ${order.publicRef}` : null,
      "",
      `Open the order: ${appUrl()}/order/${orderId}`,
    ].filter((line): line is string => line !== null);
    await sendOrderEmail(notify, { subject: `New order: ${product.title}`, text: lines.join("\n") });
  }

  redirect(`/order/${orderId}`);
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

export async function setLeadStatus(formData: FormData) {
  const user = await requireSeller();
  const kind = text(formData, "kind");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (kind === "order" && ["unpaid", "paid", "fulfilled", "canceled"].includes(status)) {
    updateOrderStatus(id, user.id, status as OrderStatus);
  } else if (kind === "quote" && ["new", "contacted", "closed"].includes(status)) {
    updateQuoteStatus(id, user.id, status as "new" | "contacted" | "closed");
  } else if (kind === "message" && ["new", "read", "closed"].includes(status)) {
    updateMessageStatus(id, user.id, status as "new" | "read" | "closed");
  }
}
