export type PayMethod = {
  id: string;
  label: string;
};

export const CA_PAYMENTS: PayMethod[] = [
  { id: "interac", label: "Interac e-Transfer" },
  { id: "cash_pickup", label: "Cash on pickup" },
];

export const US_PAYMENTS: PayMethod[] = [
  { id: "cash", label: "Cash" },
  { id: "venmo", label: "Venmo" },
  { id: "zelle", label: "Zelle" },
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

export function zelleContactProblem(mode: string, value: string) {
  if (mode === "email") {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a Zelle email.";
    return safeEmail(trimmed) ? null : "Enter an email like name@email.com.";
  }
  const trimmed = value.trim();
  if (!trimmed) return "Enter a Zelle phone number.";
  return safePhone(trimmed) ? null : "Enter a phone number.";
}

export function safeVenmo(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(trimmed)) return "";
  return trimmed;
}

export function venmoUsernameProblem(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a Venmo username.";
  return safeVenmo(trimmed) ? null : "Enter a Venmo username like @name.";
}

export function cardLinkProblem(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "Paste a credit card payment link.";
  if (trimmed.length > 500) return "Keep the payment link under 500 characters.";
  return safeCardUrl(trimmed) ? null : "Use a full http(s) payment link.";
}

export type DigitalPayMode = "paypal_email" | "stripe" | "square" | "paypal_link";

export function readDigitalPayMode(value: string): DigitalPayMode | "" {
  if (value === "paypal_email" || value === "stripe" || value === "square" || value === "paypal_link") return value;
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
  if (!trimmed || safeEmail(trimmed)) return "paypal_email";
  const url = safeCardUrl(trimmed);
  if (!url) return "paypal_email";
  const kind = payHostKind(url);
  if (kind === "stripe" || kind === "square") return kind;
  return "paypal_link";
}

export function digitalPayProblem(value: string, modeRaw = "") {
  const mode = readDigitalPayMode(modeRaw) || digitalPayModeOf(value);
  const trimmed = value.trim();
  if (trimmed.length > 500) return "Keep this under 500 characters.";
  if (mode === "paypal_email") {
    if (!trimmed) return "Enter the PayPal email where buyers pay you.";
    return safeEmail(trimmed) ? null : "Enter an email like name@email.com.";
  }
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
  const direct = safeCardUrl(trimmed);
  if (!direct) return "";
  try {
    const url = new URL(direct);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const me = host === "paypal.me" ? parts[0] : host === "paypal.com" && parts[0]?.toLowerCase() === "paypalme" ? parts[1] : "";
    if (me && /^[A-Za-z0-9._-]{1,40}$/.test(me) && payment.amountCents > 0) {
      const amount = (payment.amountCents / 100).toFixed(2);
      const currency = payment.currency === "USD" ? "USD" : "CAD";
      return `https://www.paypal.com/paypalme/${me}/${amount}${currency}`;
    }
  } catch {
    return direct;
  }
  return direct;
}
