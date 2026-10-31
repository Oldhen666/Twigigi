"use client";

export type CartItem = { productId: string; variantKey: string; quantity: number };

function key(publicId: string) {
  return `twigigi-cart:${publicId}`;
}

export function readCart(publicId: string): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(key(publicId)) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const productId = typeof row.productId === "string" ? row.productId : "";
      const variantKey = typeof row.variantKey === "string" ? row.variantKey : "";
      const quantity = Number(row.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1) return [];
      return [{ productId, variantKey, quantity }];
    });
  } catch {
    return [];
  }
}

export function writeCart(publicId: string, items: CartItem[]) {
  localStorage.setItem(key(publicId), JSON.stringify(items));
}

export function addCartItem(publicId: string, item: CartItem, cap: number) {
  const cart = readCart(publicId);
  const others = cart
    .filter((line) => line.productId === item.productId && line.variantKey !== item.variantKey)
    .reduce((sum, line) => sum + line.quantity, 0);
  const same = cart.find((line) => line.productId === item.productId && line.variantKey === item.variantKey);
  const room = Math.max(0, cap - others);
  const quantity = Math.min(room, (same?.quantity ?? 0) + Math.max(1, item.quantity));
  const next = cart.filter((line) => !(line.productId === item.productId && line.variantKey === item.variantKey));
  if (quantity > 0) next.push({ productId: item.productId, variantKey: item.variantKey, quantity });
  writeCart(publicId, next);
}

export function AddToCart({
  publicId,
  productId,
  variantKey = "",
  quantity = 1,
  cap,
  label,
}: {
  publicId: string;
  productId: string;
  variantKey?: string;
  quantity?: number;
  cap: number;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        addCartItem(publicId, { productId, variantKey, quantity }, cap);
        window.location.assign(`/${publicId}/cart`);
      }}
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-forest text-lg text-card"
    >
      {label}
    </button>
  );
}
