import { formatMoney } from "@/lib/format";

export const QUOTE_PRICE_MODES = ["custom", "starting", "range", "set"] as const;
export const QUOTE_PRICE_UNITS = ["project", "hour", "day", "visit", "sqft", "item", "custom"] as const;

export type QuotePriceMode = (typeof QUOTE_PRICE_MODES)[number];
export type QuotePriceUnit = (typeof QUOTE_PRICE_UNITS)[number];

export type QuotePrice = {
  mode: QuotePriceMode;
  amountCents: number | null;
  maxCents: number | null;
  unit: QuotePriceUnit;
  unitName: string;
  currency: string;
};

const MODE_LABELS: Record<QuotePriceMode, string> = {
  custom: "Custom quote",
  starting: "Starting price",
  range: "Price range",
  set: "Set price",
};

const UNIT_LABELS: Record<QuotePriceUnit, string> = {
  project: "Per project",
  hour: "Per hour",
  day: "Per day",
  visit: "Per visit",
  sqft: "Per sq ft",
  item: "Per item",
  custom: "Custom unit",
};

const UNIT_PHRASES: Record<Exclude<QuotePriceUnit, "custom">, string> = {
  project: "per project",
  hour: "per hour",
  day: "per day",
  visit: "per visit",
  sqft: "per sq ft",
  item: "per item",
};

export const QUOTE_PRICE_MODE_OPTIONS = QUOTE_PRICE_MODES.map((value) => ({ value, label: MODE_LABELS[value] }));
export const QUOTE_PRICE_UNIT_OPTIONS = QUOTE_PRICE_UNITS.map((value) => ({ value, label: UNIT_LABELS[value] }));

export function quotePriceMode(value: unknown): QuotePriceMode | "" {
  const mode = String(value ?? "");
  return (QUOTE_PRICE_MODES as readonly string[]).includes(mode) ? (mode as QuotePriceMode) : "";
}

export function quotePriceUnit(value: unknown): QuotePriceUnit | "" {
  const unit = String(value ?? "");
  return (QUOTE_PRICE_UNITS as readonly string[]).includes(unit) ? (unit as QuotePriceUnit) : "";
}

export function centsToQuoteInput(cents: number | null) {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

function moneyCode(currency: string) {
  return currency.trim().toUpperCase() === "USD" ? "USD" : "CAD";
}

function moneyAmount(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

function money(cents: number, currency: string, withCode: boolean) {
  const amount = `$${moneyAmount(cents)}`;
  return withCode ? `${amount} ${moneyCode(currency)}` : amount;
}

export function quoteUnitPhrase(unit: QuotePriceUnit, unitName: string) {
  if (unit === "custom") {
    const cleaned = unitName.trim().replace(/\s+/g, " ").replace(/^per\s+/i, "");
    return cleaned ? `per ${cleaned}` : "";
  }
  return UNIT_PHRASES[unit];
}

export function quotePriceReady(price: QuotePrice) {
  if (price.mode === "custom") return true;
  if (price.unit === "custom" && !quoteUnitPhrase(price.unit, price.unitName)) return false;
  if (price.mode === "range") return price.amountCents != null && price.amountCents > 0 && price.maxCents != null && price.maxCents > price.amountCents;
  return price.amountCents != null && price.amountCents > 0;
}

export function quotePriceLabel(price: QuotePrice) {
  if (!quotePriceReady(price) || price.mode === "custom") return "Pricing varies by project";
  const phrase = quoteUnitPhrase(price.unit, price.unitName);
  const tail = phrase ? ` ${phrase}` : "";
  if (price.mode === "starting" && price.amountCents != null) return `Starting at ${money(price.amountCents, price.currency, true)}${tail}`;
  if (price.mode === "set" && price.amountCents != null) return `${money(price.amountCents, price.currency, true)}${tail}`;
  if (price.mode === "range" && price.amountCents != null && price.maxCents != null) {
    return `${money(price.amountCents, price.currency, false)}–${money(price.maxCents, price.currency, false)} ${moneyCode(price.currency)}${tail}`;
  }
  return "Pricing varies by project";
}

export function quotePriceFromProduct(product: {
  priceCents: number | null;
  currency?: string;
  quotePriceMode?: string;
  quotePriceMaxCents?: number | null;
  quotePriceUnit?: string;
  quotePriceUnitCustom?: string;
}): QuotePrice {
  const currency = moneyCode(product.currency || "CAD");
  const mode = quotePriceMode(product.quotePriceMode);
  const unit = quotePriceUnit(product.quotePriceUnit) || "project";
  if (!mode) {
    if (product.priceCents != null && product.priceCents > 0) {
      return { mode: "starting", amountCents: product.priceCents, maxCents: null, unit: "project", unitName: "", currency };
    }
    return { mode: "custom", amountCents: null, maxCents: null, unit: "project", unitName: "", currency };
  }
  return {
    mode,
    amountCents: mode === "custom" ? null : product.priceCents,
    maxCents: mode === "range" ? product.quotePriceMaxCents ?? null : null,
    unit: mode === "custom" ? "project" : unit,
    unitName: mode === "custom" || unit !== "custom" ? "" : String(product.quotePriceUnitCustom ?? "").trim(),
    currency,
  };
}

function fieldText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readAmount(raw: string, publishing: boolean, key: string, errors: Record<string, string>) {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (publishing) errors[key] = "Enter an amount greater than 0.";
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    errors[key] = "Enter an amount like 8 or 8.50.";
    return null;
  }
  const cents = Math.round(Number(trimmed) * 100);
  if (cents <= 0) {
    errors[key] = "Enter an amount greater than 0.";
    return null;
  }
  return cents;
}

export function quotePriceFromForm(formData: FormData, currency: string, publishing: boolean) {
  const mode = quotePriceMode(fieldText(formData, "quotePriceMode")) || "custom";
  const unit = quotePriceUnit(fieldText(formData, "quotePriceUnit")) || "project";
  const unitName = fieldText(formData, "quotePriceUnitName").trim().replace(/\s+/g, " ").slice(0, 40);
  const errors: Record<string, string> = {};
  const code = moneyCode(currency);
  if (mode === "custom") {
    return { price: { mode, amountCents: null, maxCents: null, unit: "project" as const, unitName: "", currency: code }, errors };
  }
  if (unit === "custom" && !unitName && publishing) errors.quotePriceUnitName = "Enter a unit name.";
  const savedUnit = unit;
  const savedName = savedUnit === "custom" ? unitName : "";
  if (mode === "range") {
    const min = readAmount(fieldText(formData, "quotePriceMin"), publishing, "quotePriceMin", errors);
    const max = readAmount(fieldText(formData, "quotePriceMax"), publishing, "quotePriceMax", errors);
    if (min != null && max != null && max <= min) errors.quotePriceMax = "Enter a maximum greater than the minimum.";
    return { price: { mode, amountCents: min, maxCents: max, unit: savedUnit, unitName: savedName, currency: code }, errors };
  }
  const amount = readAmount(fieldText(formData, "quotePriceAmount"), publishing, "quotePriceAmount", errors);
  return { price: { mode, amountCents: amount, maxCents: null, unit: savedUnit, unitName: savedName, currency: code }, errors };
}

export function listingPrice(product: {
  cta: string;
  priceCents: number | null;
  currency: string;
  quotePriceMode?: string;
  quotePriceMaxCents?: number | null;
  quotePriceUnit?: string;
  quotePriceUnitCustom?: string;
}) {
  if (product.cta === "quote") return quotePriceLabel(quotePriceFromProduct(product));
  return product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request";
}
