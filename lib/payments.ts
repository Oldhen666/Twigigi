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

const LABELS = new Map([...CA_PAYMENTS, ...US_PAYMENTS].map((method) => [method.id, method.label]));

export function paymentsForCountry(country: string): PayMethod[] {
  if (country === "US") return US_PAYMENTS;
  if (country === "CA") return CA_PAYMENTS;
  return [];
}

const CASH_METHODS = new Set(["cash", "cash_pickup"]);

export function methodLabel(id: string) {
  return LABELS.get(id) ?? "";
}

export function isCashMethod(id: string) {
  return CASH_METHODS.has(id);
}

export function isTransferMethod(id: string) {
  return Boolean(methodLabel(id)) && !CASH_METHODS.has(id);
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

export function parsePaymentMethods(raw: string, country: string) {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set(paymentsForCountry(country).map((method) => method.id));
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
