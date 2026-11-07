"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { placeCartOrder } from "@/lib/actions";
import { readCart, writeCart, type CartItem } from "@/components/add-to-cart";
import { PayChoice, PickupFacts } from "@/components/checkout-choices";
import { useKeepFormValues } from "@/components/keep-form-values";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { cartFulfillmentCharge, formatMoney, type FulfillmentOption } from "@/lib/format";
import { isCashMethod, methodLabel, methodsForFulfillment } from "@/lib/payments";
import { formatClockMinutes, parsePickupChoice } from "@/lib/pickup";
import type { FormState, ProductOption, ProductVariant } from "@/lib/types";
import { resolveSelection } from "@/lib/variants";

export type CartCatalogItem = {
  id: string;
  title: string;
  slug: string;
  image: string;
  currency: string;
  priceCents: number;
  quantityAvailable: number | null;
  hasOptions: boolean;
  samePrice: boolean;
  options: ProductOption[];
  variants: ProductVariant[];
  requireName: boolean;
  requirePhone: boolean;
  paymentMethods: string[];
  cardPaymentUrl: string;
  interacEmail: string;
  interacQuestion?: string;
  interacPassword?: string;
  venmoUsername: string;
  paypalMe?: string;
  fulfillments: FulfillmentOption[];
};

export function CartCheckout({
  publicId,
  sellerName,
  catalog,
  defaultName,
  defaultEmail,
  mode = "cart",
}: {
  publicId: string;
  sellerName: string;
  catalog: CartCatalogItem[];
  defaultName: string;
  defaultEmail: string;
  mode?: "cart" | "checkout";
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(placeCartOrder, {} as FormState);
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [cartGaps, setCartGaps] = useState<string[]>([]);
  const [fulfillment, setFulfillment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [review, setReview] = useState<OrderReview | null>(null);
  const saved = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const rememberForm = useKeepFormValues(formRef, state, pending);
  const byId = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);

  useEffect(() => {
    setItems(readCart(publicId));
    const stored = readCheckoutDraft(publicId);
    setDraft(stored);
    if (stored?.fulfillment) setFulfillment(stored.fulfillment);
    if (stored?.pickupTime) setPickupTime(stored.pickupTime);
    setReady(true);
  }, [publicId]);

  useEffect(() => {
    if (!saved.current) return;
    if (state.error || state.fieldErrors) {
      localStorage.setItem(`twigigi-cart:${publicId}`, saved.current);
      saved.current = null;
    }
  }, [publicId, state]);

  function update(next: CartItem[]) {
    setItems(next);
    writeCart(publicId, next);
  }

  const rows = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) return { item, product: null, selection: null, cap: 0 };
    const cap = product.quantityAvailable == null ? 20 : Math.min(20, product.quantityAvailable);
    const selection = resolveSelection(product, item.variantKey);
    return { item, product, selection, cap };
  });
  const available = rows.filter((row) => row.product && row.selection?.available && row.selection.priceCents != null && row.cap > 0);
  const currency = available[0]?.product?.currency ?? "CAD";
  const shared = sharedFulfillment(available.map((row) => row.product?.fulfillments ?? []));
  const chosen = shared.find((option) => option.id === fulfillment) ?? shared[0];
  const merchandise = available.reduce((sum, row) => sum + (row.selection?.priceCents ?? 0) * row.item.quantity, 0);
  const shipLines = chosen
    ? available.map((row) => {
        const option = row.product?.fulfillments.find((item) => item.id === chosen.id);
        return { feeCents: option?.feeCents ?? 0, freeOverCents: option?.freeOverCents };
      })
    : [];
  const fee = chosen ? cartFulfillmentCharge(merchandise, shipLines) : 0;
  const baseFee = shipLines.reduce((max, line) => Math.max(max, line.feeCents), 0);
  const shippingWaived = Boolean(chosen && chosen.id !== "pickup" && baseFee > 0 && fee === 0);
  const total = chosen ? merchandise + fee : null;
  const requireName = available.some((row) => row.product?.requireName);
  const requirePhone = available.some((row) => row.product?.requirePhone);
  const payFulfillment = chosen && (chosen.id === "delivery" || chosen.id === "shipping") ? chosen.id : "pickup";
  const methodLists = available.map((row) => methodsForFulfillment(row.product?.paymentMethods ?? [], payFulfillment));
  const payMethods = methodLists[0]?.filter((id) => methodLists.every((list) => list.includes(id))) ?? [];
  const needsTransfer = Boolean(chosen && chosen.id !== "pickup" && payMethods.length === 0);
  const contacts = available.map((row) => row.product).filter((product): product is CartCatalogItem => Boolean(product));
  const activePickup = chosen?.id === "pickup" ? pickupTime || draft?.pickupTime || "" : "";

  useEffect(() => {
    if (chosen && chosen.id !== fulfillment) setFulfillment(chosen.id);
  }, [chosen, fulfillment]);

  const methodKey = payMethods.join("|");
  const pickupSchedules = available.map((row) => row.product?.fulfillments.find((item) => item.id === "pickup")?.schedule ?? "");
  const pickupSummaries = available.map((row) => row.product?.fulfillments.find((item) => item.id === "pickup")?.times ?? []);
  const pickupSummary = pickupSummaries.every((list) => list.join("|") === (pickupSummaries[0]?.join("|") ?? "")) ? pickupSummaries[0] ?? [] : [];
  useEffect(() => {
    setPaymentMethod((current) => (payMethods.length === 1 ? payMethods[0] : payMethods.includes(current) ? current : ""));
  }, [methodKey]);
  useEffect(() => {
    if (!ready) return;
    if (chosen?.id !== "pickup") setPickupTime("");
  }, [chosen?.id, ready]);
  useEffect(() => {
    if (state.error || state.fieldErrors) setConfirming(false);
  }, [state]);

  if (!ready) return <p className="mt-6 text-sm text-muted">Loading…</p>;
  if (mode === "checkout" && !draft) {
    return (
      <div className="mt-6">
        <p className="text-muted">Add your details in the cart before checkout.</p>
        <Link href={`/${publicId}/cart`} className={`${buttonClass} mt-4`}>Back to cart</Link>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-muted">Nothing here yet.</p>
        <Link href={`/${publicId}`} className={`${buttonClass} mt-4`}>
          See {sellerName}
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        if (mode === "cart") {
          event.preventDefault();
          goCheckout();
          return;
        }
        rememberForm(event.currentTarget);
        saved.current = localStorage.getItem(`twigigi-cart:${publicId}`);
        localStorage.removeItem(`twigigi-cart:${publicId}`);
      }}
    >
      <input type="hidden" name="lines" value={JSON.stringify(available.map((row) => row.item))} />
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {mode === "checkout" && state.fieldErrors ? (
        <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {Object.values(state.fieldErrors).map((gap) => <li key={gap}>{gap}</li>)}
        </ul>
      ) : null}
      <ul className="space-y-3">
        {rows.map((row) => {
          const product = row.product;
          const missing = !product || !row.selection?.available || row.selection.priceCents == null || row.cap < 1;
          const others = rows
            .filter((item) => item.item.productId === row.item.productId && item.item.variantKey !== row.item.variantKey)
            .reduce((sum, item) => sum + item.item.quantity, 0);
          const room = Math.max(1, row.cap - others);
          return (
            <li key={`${row.item.productId}:${row.item.variantKey}`} className="flex gap-3 rounded-2xl border border-line p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                {product?.image ? (
                  <Image src={product.image} alt="" fill unoptimized={product.image.startsWith("/uploads/")} className="object-cover" sizes="64px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product?.title ?? "No longer available"}</p>
                {row.selection?.label ? <p className="text-sm text-muted">{row.selection.label}</p> : null}
                {missing ? (
                  <p className="text-sm text-muted">Remove this to check out.</p>
                ) : (
                  <p className="text-sm text-forest">{formatMoney((row.selection?.priceCents ?? 0) * row.item.quantity, currency)}</p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {mode === "checkout" ? <span className="text-sm text-muted">Qty {row.item.quantity}</span> : null}
                  {mode === "cart" && !missing ? (
                    <div className="inline-flex items-center rounded-full border border-line">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => update(changeQuantity(items, row.item, Math.max(1, row.item.quantity - 1), room))}
                        className="h-8 w-8"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{row.item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => update(changeQuantity(items, row.item, Math.min(room, row.item.quantity + 1), room))}
                        className="h-8 w-8"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                  {mode === "cart" ? (
                    <button type="button" onClick={() => update(items.filter((item) => item !== row.item))} className="text-sm text-danger">
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {mode === "cart" ? (
        <Link href={`/${publicId}`} className="inline-block text-sm font-medium text-forest">
          Add more products from {sellerName}
        </Link>
      ) : (
        <Link href={`/${publicId}/cart`} className="inline-block text-sm text-muted">← Back to cart</Link>
      )}

      {mode === "checkout" ? (
        <>
          <input type="hidden" name="fulfillment" value={chosen?.id ?? ""} />
          <input type="hidden" name="pickupTime" value={activePickup} />
          <input type="hidden" name="name" value={draft?.name ?? defaultName} />
          <input type="hidden" name="email" value={draft?.email ?? defaultEmail} />
          <input type="hidden" name="phone" value={draft?.phone ?? ""} />
          <input type="hidden" name="address" value={draft?.address ?? ""} />
          <input type="hidden" name="deliveryNote" value={draft?.deliveryNote ?? ""} />
          <input type="hidden" name="sellerNote" value={draft?.sellerNote ?? ""} />
        </>
      ) : null}

      {mode === "checkout" || available.length === 0 ? null : shared.length === 0 ? (
        <p className="rounded-xl bg-paper-deep px-3 py-2 text-sm text-muted">These Twigs cannot be received the same way. Remove one to check out.</p>
      ) : (
        <fieldset>
          <legend className={labelClass}>How do you want it?</legend>
          <div className="space-y-2">
            {shared.map((option) => (
              <label key={option.id} className={`block rounded-2xl border px-4 py-3 ${chosen?.id === option.id ? "border-forest bg-moss" : "border-line"}`}>
                <input type="radio" name="fulfillment" value={option.id} checked={chosen?.id === option.id} onChange={() => setFulfillment(option.id)} className="mr-2" />
                <span className="font-medium">{option.label}</span>
                {option.id === "pickup" && fulfillment === option.id ? (
                  <PickupFacts
                    location={option.location ?? ""}
                    schedules={pickupSchedules}
                    summary={pickupSummary}
                    selectedTime={activePickup}
                    onTime={setPickupTime}
                    error={state.fieldErrors?.pickupTime}
                  />
                ) : null}
              </label>
            ))}
          </div>
          {state.fieldErrors?.fulfillment ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.fulfillment}</p> : null}
        </fieldset>
      )}

      {mode === "checkout" && needsTransfer ? <p className="text-sm text-danger">Delivery and shipping have to be paid by transfer first. This seller has not set one up.</p> : null}

      {mode === "checkout" ? null : requireName ? (
        <label className="block">
          <span className={labelClass}>Name<span className="text-danger"> *</span></span>
          <input name="name" autoComplete="name" defaultValue={draft?.name || defaultName} className={inputClass} />
          {state.fieldErrors?.name ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.name}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="name" value={draft?.name || defaultName} />
      )}
      {mode === "checkout" ? null : (
      <label className="block">
        <span className={labelClass}>Email<span className="text-danger"> *</span></span>
        <input name="email" type="email" autoComplete="email" defaultValue={draft?.email || defaultEmail} className={inputClass} />
        {state.fieldErrors?.email ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.email}</span> : null}
      </label>
      )}
      {mode === "checkout" ? null : requirePhone ? (
        <label className="block">
          <span className={labelClass}>Phone<span className="text-danger"> *</span></span>
          <input name="phone" type="tel" autoComplete="tel" defaultValue={draft?.phone ?? ""} className={inputClass} />
          {state.fieldErrors?.phone ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.phone}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="phone" value="" />
      )}
      {mode === "checkout" ? null : chosen && chosen.id !== "pickup" ? (
        <>
          <label className="block">
            <span className={labelClass}>Address<span className="text-danger"> *</span></span>
            <textarea name="address" rows={3} autoComplete="street-address" defaultValue={draft?.address ?? ""} className={`${inputClass} h-auto py-3`} />
            {state.fieldErrors?.address ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.address}</span> : null}
          </label>
          {chosen.id === "shipping" ? (
            <label className="block">
              <span className={labelClass}>Delivery instructions (optional)</span>
              <input name="deliveryNote" maxLength={200} placeholder="Gate code, buzzer, where to leave it" defaultValue={draft?.deliveryNote ?? ""} className={inputClass} />
              {state.fieldErrors?.deliveryNote ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.deliveryNote}</span> : null}
            </label>
          ) : null}
        </>
      ) : (
        <input type="hidden" name="address" value="" />
      )}
      {mode === "checkout" ? null : chosen ? (
        <label className="block">
          <span className={labelClass}>Note to seller (optional)</span>
          <textarea name="sellerNote" rows={3} maxLength={400} placeholder="Anything the seller should know" defaultValue={draft?.sellerNote ?? ""} className={`${inputClass} h-auto py-3`} />
          {state.fieldErrors?.sellerNote ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.sellerNote}</span> : null}
        </label>
      ) : null}

      {total != null ? (
        <div className="space-y-1 text-sm">
          <p className="flex justify-between"><span className="text-muted">Items</span><span>{formatMoney(merchandise, currency)}</span></p>
          {chosen && chosen.id !== "pickup" ? (
            <p className="flex justify-between">
              <span className="text-muted">Shipping</span>
              <span>{fee === 0 ? "Free" : formatMoney(fee, currency)}</span>
            </p>
          ) : null}
          <p className="font-serif text-3xl text-forest">{formatMoney(total, currency)}</p>
          {shippingWaived ? <p className="text-muted">Shipping is free on this order.</p> : null}
          <p className="text-muted">Shipping is calculated once for everything from {sellerName}.</p>
        </div>
      ) : null}
      {mode === "checkout" && available[0]?.product ? (
        <PayChoice
          methods={payMethods}
          selected={paymentMethod}
          onSelect={setPaymentMethod}
          interacEmail={available[0].product.interacEmail}
          interacQuestion={available[0].product.interacQuestion}
          interacPassword={available[0].product.interacPassword}
          venmoUsername={available[0].product.venmoUsername}
          paypalMe={available[0].product.paypalMe}
          amountCents={total ?? 0}
          currency={currency}
          error={state.fieldErrors?.paymentMethod}
          showPayLink={false}
          empty={needsTransfer ? "Delivery and shipping have to be paid by transfer first. This seller has not set one up." : "This seller has not added a way to pay."}
        />
      ) : null}
      {mode === "cart" && needsTransfer ? <p className="text-sm text-danger">Delivery and shipping have to be paid by transfer first. This seller has not set one up.</p> : null}
      {mode === "cart" && cartGaps.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {cartGaps.map((gap) => <li key={gap}>{gap}</li>)}
        </ul>
      ) : null}
      {mode === "cart" ? (
        <button
          type="button"
          disabled={available.length === 0 || !chosen || needsTransfer || total == null}
          onClick={goCheckout}
          className={`${buttonClass} h-14 w-full rounded-2xl text-lg`}
        >
          Checkout
        </button>
      ) : (
        <button
          type="button"
          disabled={pending || available.length === 0 || !chosen || needsTransfer || total == null}
          onClick={openReview}
          className={`${buttonClass} h-14 w-full rounded-2xl text-lg`}
        >
          Place order
        </button>
      )}
      {confirming && review && chosen && total != null ? (
        <OrderReviewDialog
          lines={available.map((row) => ({
            title: row.product?.title ?? "Twig",
            label: row.selection?.label ?? "",
            quantity: row.item.quantity,
            amount: formatMoney((row.selection?.priceCents ?? 0) * row.item.quantity, currency),
          }))}
          fulfillment={chosen.label}
          pickup={chosen.id === "pickup"}
          pickupLocation={chosen.location ?? ""}
          pickupTime={activePickup}
          address={review.address}
          deliveryNote={chosen.id === "pickup" ? "" : review.deliveryNote}
          sellerNote={review.sellerNote}
          payment={paymentMethod ? methodLabel(paymentMethod) : ""}
          cash={isCashMethod(paymentMethod)}
          shipping={chosen.id === "pickup" ? "" : fee === 0 ? "Free" : formatMoney(fee, currency)}
          currency={currency}
          total={formatMoney(total, currency)}
          gaps={reviewGaps(review, {
            requireName,
            requirePhone,
            pickup: chosen.id === "pickup",
            needsAddress: chosen.id !== "pickup",
            needsPayment: true,
            paymentMethod,
            pickupTime: activePickup,
          })}
          pending={pending}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </form>
  );

  function goCheckout() {
    const form = formRef.current;
    if (!form || !chosen) return;
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const time = chosen.id === "pickup" ? activePickup || read("pickupTime") : "";
    const next = {
      fulfillment: chosen.id,
      pickupTime: time,
      name: read("name"),
      email: read("email"),
      phone: read("phone"),
      address: read("address"),
      deliveryNote: read("deliveryNote"),
      sellerNote: read("sellerNote"),
    };
    const gaps = reviewGaps(next, {
      requireName,
      requirePhone,
      pickup: chosen.id === "pickup",
      needsAddress: chosen.id !== "pickup",
      needsPayment: false,
      paymentMethod: "",
      pickupTime: time,
    });
    setCartGaps(gaps);
    if (gaps.length > 0) return;
    writeCheckoutDraft(publicId, next);
    router.push(`/${publicId}/cart/checkout`);
  }

  function openReview() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    setReview({
      name: read("name"),
      email: read("email"),
      phone: read("phone"),
      address: read("address"),
      deliveryNote: read("deliveryNote"),
      sellerNote: read("sellerNote"),
    });
    setConfirming(true);
  }
}

type CheckoutDraft = {
  fulfillment: string;
  pickupTime: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  deliveryNote: string;
  sellerNote: string;
};

function draftKey(publicId: string) {
  return `twigigi-cart-draft:${publicId}`;
}

function readCheckoutDraft(publicId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(publicId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CheckoutDraft>;
    if (!value || typeof value.fulfillment !== "string") return null;
    return {
      fulfillment: value.fulfillment,
      pickupTime: typeof value.pickupTime === "string" ? value.pickupTime : "",
      name: typeof value.name === "string" ? value.name : "",
      email: typeof value.email === "string" ? value.email : "",
      phone: typeof value.phone === "string" ? value.phone : "",
      address: typeof value.address === "string" ? value.address : "",
      deliveryNote: typeof value.deliveryNote === "string" ? value.deliveryNote : "",
      sellerNote: typeof value.sellerNote === "string" ? value.sellerNote : "",
    };
  } catch {
    return null;
  }
}

function writeCheckoutDraft(publicId: string, draft: CheckoutDraft) {
  sessionStorage.setItem(draftKey(publicId), JSON.stringify(draft));
}

function sharedFulfillment(lists: FulfillmentOption[][]) {
  if (lists.length === 0) return [];
  return lists[0].filter((option) => lists.every((list) => list.some((item) => item.id === option.id)));
}

function changeQuantity(items: CartItem[], target: CartItem, quantity: number, room: number) {
  return items.map((item) => item === target ? { ...item, quantity: Math.min(room, Math.max(1, quantity)) } : item);
}

function firstText(items: CartCatalogItem[], pick: (item: CartCatalogItem) => string) {
  return items.map(pick).find((value) => value.trim()) ?? "";
}

type OrderReview = {
  name: string;
  email: string;
  phone: string;
  address: string;
  deliveryNote: string;
  sellerNote: string;
};

function reviewGaps(review: OrderReview, rules: {
  requireName: boolean;
  requirePhone: boolean;
  pickup: boolean;
  needsAddress: boolean;
  needsPayment: boolean;
  paymentMethod: string;
  pickupTime: string;
}) {
  const gaps: string[] = [];
  if (rules.requireName && review.name.length < 2) gaps.push("Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(review.email)) gaps.push("Add a valid email.");
  if (rules.requirePhone && review.phone.length < 7) gaps.push("Add your phone number.");
  if (rules.needsAddress && review.address.length < 4) gaps.push("Add the address.");
  if (rules.pickup && !rules.pickupTime) gaps.push("Choose a pickup time.");
  if (rules.needsPayment && !rules.paymentMethod) gaps.push("Choose how you will pay.");
  if (review.sellerNote.length > 400) gaps.push("Keep the note under 400 characters.");
  return gaps;
}

function OrderReviewDialog({
  lines,
  fulfillment,
  pickup,
  pickupLocation,
  pickupTime,
  address,
  deliveryNote,
  sellerNote,
  payment,
  cash,
  shipping,
  currency,
  total,
  gaps,
  pending,
  onClose,
}: {
  lines: { title: string; label: string; quantity: number; amount: string }[];
  fulfillment: string;
  pickup: boolean;
  pickupLocation: string;
  pickupTime: string;
  address: string;
  deliveryNote: string;
  sellerNote: string;
  payment: string;
  cash: boolean;
  shipping: string;
  currency: string;
  total: string;
  gaps: string[];
  pending: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => { if (!pending) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-review-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-card p-5 shadow-[0_24px_80px_rgba(70,48,16,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="order-review-title" className="font-serif text-3xl">Review your order</h2>
        <div className="mt-5 space-y-4">
          {lines.map((line) => (
            <div key={`${line.title}-${line.label}`} className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{line.title}{line.label ? ` · ${line.label}` : ""}</p>
                <p className="text-sm text-muted">Quantity: {line.quantity}</p>
              </div>
              <p className="font-medium">{line.amount}</p>
            </div>
          ))}
        </div>

        <section className="mt-5 border-t border-line pt-5">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{pickup ? "Pickup details" : fulfillment.toLowerCase().includes("ship") ? "Shipping details" : "Delivery details"}</h3>
          <div className="mt-3 flex items-center gap-2 font-medium">
            <PinIcon />
            <span>{fulfillment}</span>
          </div>
          <p className="mt-1 pl-6 text-sm text-muted">{pickup ? pickupLocation || "The seller has not added a pickup location." : address || "Not entered"}</p>
          {pickup ? (
            <>
              <div className="mt-3 flex items-center gap-2 font-medium">
                <CalendarIcon />
                <span>{reviewPickupWhen(pickupTime) || "Not chosen"}</span>
              </div>
              {pickupTime ? <p className="mt-1 pl-6 text-sm text-muted">Pickup time selected</p> : null}
            </>
          ) : null}
          {deliveryNote ? <p className="mt-3 text-sm text-muted">Delivery instructions: {deliveryNote}</p> : null}
          {sellerNote ? <p className="mt-3 text-sm text-muted">Note to seller: {sellerNote}</p> : null}
        </section>

        <section className="mt-5 border-t border-line pt-5">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Payment</h3>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <BankIcon />
              <span>{payment || "Not chosen"}</span>
            </div>
            {payment ? <span className="rounded-full bg-forest/10 px-2.5 py-1 text-xs text-forest">{cash ? "Pay at pickup" : "Pay seller directly"}</span> : null}
          </div>
          <p className="mt-2 text-sm text-muted">
            {cash
              ? "You pay in cash when you pick it up. It stays unpaid until the seller confirms the cash."
              : "You'll receive payment details after placing your order."}
          </p>
          <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
            {shipping ? <div className="mb-2 flex justify-between text-sm text-muted"><span>Shipping</span><span>{shipping}</span></div> : null}
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">Order total</p>
              <p className="text-2xl font-semibold text-forest">{total} {currency}</p>
            </div>
          </div>
          <p className="mt-4 flex gap-2 text-sm leading-6 text-muted">
            <AlertIcon />
            <span>
              {cash
                ? "You pay the seller in person. Twigigi does not take the payment."
                : "Payments are made directly to the seller and are not protected by Twigigi. Only send money when you're comfortable with the seller."}
            </span>
          </p>
        </section>

        {gaps.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
            {gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        ) : null}
        <button type="submit" disabled={pending || gaps.length > 0} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-base font-medium text-card disabled:opacity-60">
          {pending ? "Placing…" : "Place order →"}
        </button>
        <button type="button" disabled={pending} onClick={onClose} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full border border-line bg-card text-base font-medium">
          Back to checkout
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-muted">
          By placing your order, you agree to Twigigi&apos;s <Link href="/terms" className="text-forest">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}

function reviewPickupWhen(value: string) {
  const parsed = parsePickupChoice(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const label = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  return `${label} at ${formatClockMinutes(parsed.minutes)}`;
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d="M8 14s4.5-4.1 4.5-7.2A4.5 4.5 0 0 0 3.5 6.8C3.5 9.9 8 14 8 14Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="6.7" r="1.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <rect x="2.2" y="3.2" width="11.6" height="10.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 6.4h11.6M5.2 2.2v2.2M10.8 2.2v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d="M2.4 6.4 8 3.1l5.6 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.5 6.6v5M6.5 6.6v5M9.5 6.6v5M12.5 6.6v5M2.4 11.8h11.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8v3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="10.8" r="0.7" fill="currentColor" />
    </svg>
  );
}
