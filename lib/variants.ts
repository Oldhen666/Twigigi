import type { ProductOption, ProductVariant } from "@/lib/types";

export const MAX_OPTIONS = 3;
export const MAX_VALUES = 5;
export const OPTION_NAMES = ["Color", "Type", "Size"] as const;
const KEY_SEP = "\u001f";

export function variantKey(values: string[]) {
  return values.join(KEY_SEP);
}

export function variantLabel(key: string) {
  return key.split(KEY_SEP).filter(Boolean).join(" / ");
}

export function optionCombinations(options: ProductOption[]) {
  const usable = options.filter((option) => option.name.trim() && option.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<string[][]>(
    (sets, option) => sets.flatMap((prefix) => option.values.map((value) => [...prefix, value])),
    [[]],
  );
}

export function sanitizeOptions(input: unknown): ProductOption[] {
  if (!Array.isArray(input)) return [];
  const options: ProductOption[] = [];
  const names = new Set<string>();
  for (const item of input) {
    if (options.length >= MAX_OPTIONS) break;
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim().slice(0, 40);
    if (!name || names.has(name.toLowerCase())) continue;
    const rawValues = Array.isArray((item as { values?: unknown }).values)
      ? (item as { values: unknown[] }).values
      : [];
    const values: string[] = [];
    const seen = new Set<string>();
    for (const value of rawValues) {
      if (values.length >= MAX_VALUES) break;
      const text = String(value ?? "").trim().slice(0, 40);
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      values.push(text);
    }
    if (values.length === 0) continue;
    names.add(name.toLowerCase());
    options.push({ name, values });
  }
  return options;
}

export function normalizeVariants(options: ProductOption[], raw: unknown, fallbackPrice: number): ProductVariant[] {
  const previous = Array.isArray(raw) ? (raw as Array<Partial<ProductVariant>>) : [];
  const price = Number.isInteger(fallbackPrice) && fallbackPrice >= 0 ? fallbackPrice : 0;
  return optionCombinations(options).map((values) => {
    const key = variantKey(values);
    const found = previous.find((item) => item?.key === key);
    const stored = found?.priceCents;
    const priceCents = Number.isInteger(stored) && (stored as number) >= 0 ? Math.min(stored as number, 10_000_000) : price;
    return {
      key,
      priceCents,
      available: found ? found.available !== false : true,
      sku: typeof found?.sku === "string" ? found.sku.trim().slice(0, 40) : "",
    };
  });
}

export function readStoredOptions(raw: string) {
  try {
    return sanitizeOptions(JSON.parse(raw || "[]"));
  } catch {
    return [];
  }
}

export function readStoredVariants(raw: string, options: ProductOption[], fallbackPrice: number) {
  try {
    return normalizeVariants(options, JSON.parse(raw || "[]"), fallbackPrice);
  } catch {
    return normalizeVariants(options, [], fallbackPrice);
  }
}

export function resolveSelection(
  product: {
    hasOptions: boolean;
    samePrice: boolean;
    options: ProductOption[];
    variants: ProductVariant[];
    priceCents: number | null;
  },
  key: string,
) {
  if (!product.hasOptions || product.options.length === 0) {
    return { priceCents: product.priceCents, label: "", sku: "", available: true };
  }
  const values = key.split(KEY_SEP);
  const match = optionCombinations(product.options).find(
    (combo) => combo.length === values.length && combo.every((value, index) => value === values[index]),
  );
  if (!match) return null;
  const label = match.join(" / ");
  if (product.samePrice) {
    return { priceCents: product.priceCents, label, sku: "", available: true };
  }
  const stored = product.variants.find((item) => item.key === variantKey(match));
  return {
    priceCents: stored?.priceCents ?? product.priceCents,
    label,
    sku: stored?.sku ?? "",
    available: stored ? stored.available : true,
  };
}

export function readBuyOffer(input: {
  hasOptions: boolean;
  samePrice: boolean;
  optionsJson: string;
  variantsJson: string;
  priceCents: number | null;
  publishing: boolean;
}) {
  const errors: Record<string, string> = {};
  if (!input.hasOptions) {
    return { hasOptions: false, samePrice: true, options: [] as ProductOption[], variants: [] as ProductVariant[], errors };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input.optionsJson || "[]");
  } catch {
    errors.options = "Options could not be read. Add them again.";
    return { hasOptions: true, samePrice: true, options: [] as ProductOption[], variants: [] as ProductVariant[], errors };
  }
  if (!Array.isArray(raw)) {
    errors.options = "Options could not be read. Add them again.";
    return { hasOptions: true, samePrice: true, options: [] as ProductOption[], variants: [] as ProductVariant[], errors };
  }
  if (raw.length > MAX_OPTIONS) errors.options = "Use up to 3 options.";

  const complete = raw.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    const values = Array.isArray((item as { values?: unknown }).values)
      ? (item as { values: unknown[] }).values.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];
    return Boolean(name) && values.length > 0;
  });
  if (input.publishing && raw.some((item) => !complete.includes(item))) {
    errors.options = "Give each option a name and at least one value.";
  }
  const options = sanitizeOptions(complete).filter((option) =>
    OPTION_NAMES.some((name) => name.toLowerCase() === option.name.toLowerCase()),
  );
  if (!errors.options && complete.length > 0 && options.length !== complete.length) {
    errors.options = "Use Color, Type, and Size, with at most 5 values each.";
  }
  if (options.length === 0) {
    return { hasOptions: false, samePrice: true, options: [] as ProductOption[], variants: [] as ProductVariant[], errors };
  }

  let parsedVariants: unknown = [];
  try {
    parsedVariants = JSON.parse(input.variantsJson || "[]");
  } catch {
    parsedVariants = [];
  }
  const variants = normalizeVariants(options, parsedVariants, input.priceCents ?? 0);
  if (input.publishing && !input.samePrice && variants.length > 0) {
    if (variants.some((item) => item.priceCents < 50)) {
      errors.variants = "Each combination needs a price of at least $0.50.";
    } else if (variants.every((item) => !item.available)) {
      errors.variants = "Leave at least one combination available.";
    }
  }

  return {
    hasOptions: options.length > 0 || input.hasOptions,
    samePrice: input.samePrice || options.length === 0,
    options,
    variants,
    errors,
  };
}
