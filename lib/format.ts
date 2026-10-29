import type { Cta, Fulfillment, Product } from "@/lib/types";

export const SRC_COOKIE = "twg_src";

export const RESERVED_USERNAMES = new Set([
  "about",
  "admin",
  "api",
  "app",
  "dashboard",
  "favicon.ico",
  "help",
  "login",
  "message",
  "messages",
  "new",
  "order",
  "orders",
  "p",
  "pricing",
  "quote",
  "quotes",
  "seed",
  "settings",
  "share",
  "sign-up",
  "signup",
  "static",
  "uploads",
  "history",
  "forgot",
  "reset",
  "reviews",
  "saved",
  "start",
  "www",
]);

export function isPrivateUsername(username: string) {
  return /^[ub][0-9a-f]{12}$/.test(username);
}

export function interactionLabel(item: { buyerConfirmedAt: string | null; sellerConfirmedAt: string | null }) {
  if (item.buyerConfirmedAt && item.sellerConfirmedAt) return "Verified transaction";
  if (item.buyerConfirmedAt) return "Buyer confirmed";
  if (item.sellerConfirmedAt) return "Seller confirmed";
  return "Open";
}

const SRC_LABELS: Record<string, string> = {
  direct: "Direct",
  email: "Email",
  facebook: "Facebook",
  google: "Google",
  instagram: "Instagram",
  pinterest: "Pinterest",
  qr: "QR code",
  reddit: "Reddit",
  referral: "Other sites",
  sms: "SMS",
  snapchat: "Snapchat",
  threads: "Threads",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X",
  youtube: "YouTube",
};

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function productUrl(username: string, slug: string) {
  return `${appUrl()}/${username}/${slug}`;
}

export function withSrc(url: string, src: string) {
  const next = new URL(url);
  next.searchParams.set("src", src);
  return next.toString();
}

export function formatMoney(cents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatSignedMoney(cents: number, currency = "CAD") {
  const amount = formatMoney(Math.abs(cents), currency);
  if (cents > 0) return `+${amount}`;
  if (cents < 0) return `-${amount}`;
  return amount;
}

export function formatDay(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

const BILLING_ZONE = "America/Edmonton";

export function isTwigLive(product: { status: string; deactivatesAt?: string | null }, now?: number) {
  if (product.status !== "published") return false;
  if (!product.deactivatesAt) return true;
  const ends = Date.parse(product.deactivatesAt);
  return Number.isFinite(ends) && ends > (now ?? Date.now());
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute"), second: read("second") };
}

function edmontonMidnight(year: number, month: number, day: number) {
  let utc = Date.UTC(year, month - 1, day, 7, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = zonedParts(new Date(utc), BILLING_ZONE);
    const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const target = Date.UTC(year, month - 1, day, 0, 0, 0);
    const delta = target - shownUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc).toISOString();
}

export function periodStart(now = new Date()) {
  const current = zonedParts(now, BILLING_ZONE);
  return edmontonMidnight(current.year, current.month, 1);
}

export function nextBillingDate(now = new Date()) {
  const current = zonedParts(now, BILLING_ZONE);
  const month = current.month === 12 ? 1 : current.month + 1;
  const year = current.month === 12 ? current.year + 1 : current.year;
  return edmontonMidnight(year, month, 1);
}

export const DEACTIVATION_GRACE_DAYS = 30;

export function addDays(iso: string, days: number) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const parts = zonedParts(new Date(time), BILLING_ZONE);
  let utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 7, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = zonedParts(new Date(utc), BILLING_ZONE);
    const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const target = Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0);
    const delta = target - shownUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc).toISOString();
}

export function formatBillingDate(iso: string, withYear = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BILLING_ZONE,
    month: "long",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  }).format(date);
}

export function billingYear(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: BILLING_ZONE, year: "numeric" }).format(date);
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function centsToInput(cents: number | null) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function slugify(input: string) {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "item";
}

export function normalizeSrc(input: string | null | undefined) {
  if (!input) return "";
  const value = input.toLowerCase().trim();
  if (!value) return "";
  const aliases: Record<string, string> = {
    fb: "facebook",
    ig: "instagram",
    twitter: "x",
    yt: "youtube",
  };
  const mapped = aliases[value] ?? value;
  if (!/^[a-z0-9_-]{1,32}$/.test(mapped)) return "";
  return mapped;
}

export function srcLabel(src: string) {
  return SRC_LABELS[src] ?? src.replace(/[-_]/g, " ");
}

export function srcFromReferrer(referrer: string) {
  if (!referrer) return "";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    const own = new URL(appUrl()).hostname;
    if (host === own || host === "localhost" || host === "127.0.0.1") return "";
    if (host.includes("facebook") || host === "fb.com" || host.endsWith(".fb.com")) return "facebook";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
    if (host.includes("pinterest")) return "pinterest";
    if (host.includes("reddit")) return "reddit";
    if (host.includes("threads")) return "threads";
    if (host === "x.com" || host === "t.co" || host.includes("twitter")) return "x";
    if (host.includes("snapchat")) return "snapchat";
    if (host.includes("google")) return "google";
    if (host.includes("whatsapp") || host === "wa.me") return "whatsapp";
    return "referral";
  } catch {
    return "";
  }
}

export function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export function readCta(value: string | undefined): Cta | null {
  return value === "buy" || value === "quote" || value === "contact" ? value : null;
}

export function ctaCopy(cta: Cta) {
  if (cta === "buy") return { label: "Buy now", href: "buy" };
  if (cta === "quote") return { label: "Get a quote", href: "quote" };
  return { label: "Contact seller", href: "contact" };
}

export function videoEmbed(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type FulfillmentOption = {
  id: Fulfillment | "onsite" | "remote" | "at_location";
  label: string;
  detail: string;
  feeCents: number;
};

export function pickupDetail(note: string, time: string) {
  const times = time
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const parts = [note.trim(), ...times].filter(Boolean);
  return parts.join(" · ") || "Pickup details are sent after you order.";
}

export function fulfillmentOptions(product: Pick<
  Product,
  | "pickupEnabled"
  | "pickupNote"
  | "pickupTime"
  | "cta"
  | "deliveryEnabled"
  | "deliveryRadiusKm"
  | "deliveryFeeCents"
  | "shippingEnabled"
  | "shippingFeeCents"
  | "shippingNote"
  | "onsiteEnabled"
  | "remoteEnabled"
  | "atLocationEnabled"
  | "currency"
>): FulfillmentOption[] {
  const options: FulfillmentOption[] = [];
  const quote = product.cta === "quote";
  if (product.pickupEnabled) {
    options.push({
      id: "pickup",
      label: "Local pickup",
      detail: quote
        ? "Customer picks it up"
        : pickupDetail(product.pickupNote, product.pickupTime),
      feeCents: 0,
    });
  }
  if (product.deliveryEnabled) {
    const radius = product.deliveryRadiusKm ? `Within ${product.deliveryRadiusKm} km` : "Local delivery";
    const fee =
      product.deliveryFeeCents && product.deliveryFeeCents > 0
        ? formatMoney(product.deliveryFeeCents, product.currency)
        : "No delivery fee";
    options.push({
      id: "delivery",
      label: "Local delivery",
      detail: quote ? "You deliver to the customer" : `${radius} · ${fee}`,
      feeCents: quote ? 0 : (product.deliveryFeeCents ?? 0),
    });
  }
  if (product.shippingEnabled) {
    const fee =
      product.shippingFeeCents && product.shippingFeeCents > 0
        ? formatMoney(product.shippingFeeCents, product.currency)
        : "Shipping fee confirmed by the seller";
    options.push({
      id: "shipping",
      label: product.cta === "buy" && !product.deliveryEnabled ? "Delivery / Shipping" : "Shipping",
      detail: quote ? "Ship by mail or courier" : product.shippingNote ? `${product.shippingNote} · ${fee}` : fee,
      feeCents: quote ? 0 : (product.shippingFeeCents ?? 0),
    });
  }
  if (product.onsiteEnabled) {
    options.push({ id: "onsite", label: "On-site service", detail: "You go to the customer's location", feeCents: 0 });
  }
  if (product.remoteEnabled) {
    options.push({ id: "remote", label: "Remote service", detail: "Provided online or remotely", feeCents: 0 });
  }
  if (product.atLocationEnabled) {
    options.push({ id: "at_location", label: "At my location", detail: "Customer comes to your business/location", feeCents: 0 });
  }
  return options;
}

export function orderAmount(
  priceCents: number,
  quantity: number,
  fulfillment: Fulfillment,
  product: Parameters<typeof fulfillmentOptions>[0],
) {
  const option = fulfillmentOptions(product).find((item) => item.id === fulfillment);
  if (!option) return null;
  return priceCents * quantity + option.feeCents;
}
