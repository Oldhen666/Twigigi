export type PayMethod = {
  id: string;
  label: string;
};

export const CA_PAYMENTS: PayMethod[] = [
  { id: "interac", label: "Interac e-Transfer" },
  { id: "cash_pickup", label: "Cash on pickup" },
  { id: "paypal", label: "PayPal" },
];

export const US_PAYMENTS: PayMethod[] = [
  { id: "cash", label: "Cash" },
  { id: "venmo", label: "Venmo" },
  { id: "paypal", label: "PayPal" },
];

export const CARD_PAYMENT: PayMethod = { id: "card", label: "Credit card" };

const LABELS = new Map([...CA_PAYMENTS, ...US_PAYMENTS, CARD_PAYMENT].map((method) => [method.id, method.label]));

export function paymentsForCountry(country: string): PayMethod[] {
  if (country === "US") return US_PAYMENTS;
  if (country === "CA") return CA_PAYMENTS;
  return [];
}

export function paymentsForDigitalFile(): PayMethod[] {
  return [CARD_PAYMENT];
}

const CASH_METHODS = new Set(["cash", "cash_pickup"]);

export function methodLabel(id: string) {
  return LABELS.get(id) ?? "";
}

export function isCashMethod(id: string) {
  return CASH_METHODS.has(id);
}

export function isTransferMethod(id: string) {
  return id !== "card" && Boolean(methodLabel(id)) && !CASH_METHODS.has(id);
}

export function methodsForFulfillment(methods: string[], fulfillment: "pickup" | "delivery" | "shipping") {
  if (fulfillment === "pickup") return methods.filter((id) => methodLabel(id));
  return methods.filter((id) => isTransferMethod(id));
}

export function sellerContactProblem(mode: string, value: string) {
  if (mode === "phone") {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a phone number.";
    return safePhone(trimmed) ? null : "Enter a phone number.";
  }
  const trimmed = value.trim();
  if (!trimmed) return "Enter an email.";
  return safeEmail(trimmed) ? null : "Enter an email like name@email.com.";
}

export function parsePaymentMethods(raw: string, country: string, digital = false) {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set((digital ? paymentsForDigitalFile() : paymentsForCountry(country)).map((method) => method.id));
  const methods: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string" || !allowed.has(item) || methods.includes(item)) continue;
    methods.push(item);
  }
  return methods;
}

export function safeCardUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function safeEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return trimmed;
}

export function interacEmailProblem(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter an Interac e-Transfer email.";
  return safeEmail(trimmed) ? null : "Enter an email like name@email.com.";
}

export function safePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed || digits.length < 7 || digits.length > 15) return "";
  return trimmed;
}

export function safeVenmo(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(trimmed)) return "";
  return trimmed;
}

export function venmoUsernameFrom(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("://") && !trimmed.includes("/")) return safeVenmo(trimmed);
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return "";
  }
  if (url.username || url.password || (url.protocol !== "https:" && url.protocol !== "http:")) return "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "venmo.com" && parts.length === 1) return safeVenmo(parts[0]);
  if (host === "account.venmo.com" && parts[0] === "u" && parts[1] && parts.length === 2) return safeVenmo(parts[1]);
  return "";
}

export function venmoUsernameProblem(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a Venmo username.";
  if (trimmed.includes("://") || trimmed.includes("/")) {
    return venmoUsernameFrom(trimmed) ? null : "Use a venmo.com profile link, like https://venmo.com/yourname.";
  }
  return safeVenmo(trimmed) ? null : "Enter a Venmo username like johnsmith.";
}

export function venmoProfileUrl(username: string) {
  const name = safeVenmo(username);
  return name ? `https://venmo.com/${name}` : "";
}

export function venmoPayUrl(username: string, payment: { amountCents: number; note?: string }) {
  const profile = venmoProfileUrl(username);
  if (!profile || payment.amountCents < 1) return "";
  const amount = (payment.amountCents / 100).toFixed(2);
  const note = (payment.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const query = note ? `txn=pay&amount=${amount}&note=${encodeURIComponent(note)}` : `txn=pay&amount=${amount}`;
  return `${profile}?${query}`;
}

const PAYPAL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

function readPaypalMe(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.username || url.password || (url.protocol !== "http:" && url.protocol !== "https:")) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "paypal.me") return { name: parts[0] ?? "", extra: parts.slice(1), search: url.search };
  if ((host === "paypal.com" || host.endsWith(".paypal.com")) && parts[0]?.toLowerCase() === "paypalme") {
    return { name: parts[1] ?? "", extra: parts.slice(2), search: url.search };
  }
  return null;
}

export function paypalMeName(value: string, allowAmount = false) {
  const parsed = readPaypalMe(value);
  if (!parsed || !PAYPAL_NAME.test(parsed.name)) return "";
  if (!allowAmount && (parsed.extra.length > 0 || parsed.search)) return "";
  return parsed.name;
}

export function paypalMeProblem(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your PayPal.Me link.";
  if (trimmed.length > 200) return "Keep the PayPal.Me link under 200 characters.";
  const parsed = readPaypalMe(trimmed);
  if (!parsed || !PAYPAL_NAME.test(parsed.name)) return "Use a paypal.me link. Other websites are not accepted.";
  if (parsed.extra.length > 0 || parsed.search) return "Leave the amount off. Example: https://paypal.me/yourname";
  return null;
}

export function paypalMeUrl(stored: string, payment: { amountCents: number; currency: string }) {
  const name = paypalMeName(stored, true);
  if (!name || payment.amountCents < 1) return "";
  const amount = (payment.amountCents / 100).toFixed(2);
  const code = payment.currency.trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(code) ? code : "CAD";
  return `https://paypal.me/${name}/${amount}${currency}`;
}

export function cardLinkProblem(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "Paste a credit card payment link.";
  if (trimmed.length > 500) return "Keep the payment link under 500 characters.";
  return safeCardUrl(trimmed) ? null : "Use a full http(s) payment link.";
}

export type DigitalPayMode = "paypal_me" | "stripe" | "square" | "paypal_link";

export function readDigitalPayMode(value: string): DigitalPayMode | "" {
  if (value === "paypal_me" || value === "paypal_email") return "paypal_me";
  if (value === "stripe" || value === "square" || value === "paypal_link") return value;
  return "";
}

function payHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function payHostKind(url: string) {
  const host = payHost(url);
  if (host === "stripe.com" || host.endsWith(".stripe.com")) return "stripe";
  if (
    host === "square.link" ||
    host.endsWith(".square.link") ||
    host === "squareup.com" ||
    host.endsWith(".squareup.com") ||
    host === "square.site" ||
    host.endsWith(".square.site")
  ) {
    return "square";
  }
  if (host === "paypal.com" || host.endsWith(".paypal.com") || host === "paypal.me") return "paypal";
  return "other";
}

export function digitalPayModeOf(value: string): DigitalPayMode {
  const trimmed = value.trim();
  if (paypalMeName(trimmed)) return "paypal_me";
  if (!trimmed || safeEmail(trimmed)) return "paypal_me";
  const url = safeCardUrl(trimmed);
  if (!url) return "paypal_me";
  const kind = payHostKind(url);
  if (kind === "stripe" || kind === "square") return kind;
  if (kind === "paypal") return "paypal_link";
  return "paypal_me";
}

export function digitalPayProblem(value: string, modeRaw = "") {
  const mode = readDigitalPayMode(modeRaw) || digitalPayModeOf(value);
  const trimmed = value.trim();
  if (trimmed.length > 500) return "Keep this under 500 characters.";
  if (mode === "paypal_me") return paypalMeProblem(trimmed);
  if (!trimmed) {
    if (mode === "stripe") return "Paste your Stripe Payment Link.";
    if (mode === "square") return "Paste your Square payment link.";
    return "Paste your PayPal payment link.";
  }
  const url = safeCardUrl(trimmed);
  if (!url) return "Use a full https payment link.";
  const kind = payHostKind(url);
  if (mode === "stripe" && kind !== "stripe") return "Paste a Stripe link, such as https://buy.stripe.com/…";
  if (mode === "square" && kind !== "square") return "Paste a Square link, such as https://square.link/…";
  if (mode === "paypal_link" && kind !== "paypal") return "Paste a PayPal link, such as https://paypal.me/…";
  return null;
}

export function buyerPayUrl(stored: string, payment: { amountCents: number; currency: string; itemName: string }) {
  const trimmed = stored.trim();
  const email = safeEmail(trimmed);
  if (email) {
    if (payment.amountCents < 1) return "";
    const amount = (payment.amountCents / 100).toFixed(2);
    const currency = payment.currency === "USD" ? "USD" : "CAD";
    const params = new URLSearchParams({
      cmd: "_xclick",
      business: email,
      amount,
      currency_code: currency,
      item_name: payment.itemName.replace(/\s+/g, " ").trim().slice(0, 127) || "Digital file",
      no_shipping: "1",
    });
    return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
  }
  const me = paypalMeUrl(trimmed, payment);
  if (me) return me;
  const direct = safeCardUrl(trimmed);
  return direct;
}
