"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { placeCartOrder } from "@/lib/actions";
import { readCart, writeCart, type CartItem } from "@/components/add-to-cart";
import { PayChoice, PickupFacts } from "@/components/checkout-choices";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { cartFulfillmentCharge, formatMoney, type FulfillmentOption } from "@/lib/format";
import { methodsForFulfillment } from "@/lib/payments";
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
  venmoUsername: string;
  zelleMode: "phone" | "email";
  zelleContact: string;
  fulfillments: FulfillmentOption[];
};

export function CartCheckout({
  publicId,
  sellerName,
  catalog,
  defaultName,
  defaultEmail,
}: {
  publicId: string;
  sellerName: string;
  catalog: CartCatalogItem[];
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, action, pending] = useActionState(placeCartOrder, {} as FormState);
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [fulfillment, setFulfillment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const saved = useRef<string | null>(null);
  const byId = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);

  useEffect(() => {
    setItems(readCart(publicId));
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

  useEffect(() => {
    if (chosen && chosen.id !== fulfillment) setFulfillment(chosen.id);
  }, [chosen, fulfillment]);

  const methodKey = payMethods.join("|");
  const timeKey = (chosen?.times ?? []).join("|");
  useEffect(() => {
    setPaymentMethod((current) => (payMethods.length === 1 ? payMethods[0] : payMethods.includes(current) ? current : ""));
    const times = chosen?.id === "pickup" ? chosen.times ?? [] : [];
    setPickupTime((current) => (times.length <= 1 ? times[0] ?? "" : times.includes(current) ? current : ""));
  }, [methodKey, chosen?.id, timeKey]);

  if (!ready) return <p className="mt-6 text-sm text-muted">Loading…</p>;
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
      action={action}
      noValidate
      className="mt-6 space-y-4"
      onSubmit={() => {
        saved.current = localStorage.getItem(`twigigi-cart:${publicId}`);
        localStorage.removeItem(`twigigi-cart:${publicId}`);
      }}
    >
      <input type="hidden" name="lines" value={JSON.stringify(available.map((row) => row.item))} />
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
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
                  {missing ? null : (
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
                  )}
                  <button type="button" onClick={() => update(items.filter((item) => item !== row.item))} className="text-sm text-danger">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Link href={`/${publicId}`} className="inline-block text-sm font-medium text-forest">
        Add another Twig
      </Link>

      {available.length === 0 ? null : shared.length === 0 ? (
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
                    times={option.times ?? []}
                    selectedTime={pickupTime}
                    onTime={setPickupTime}
                  />
                ) : null}
              </label>
            ))}
          </div>
          {state.fieldErrors?.fulfillment ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.fulfillment}</p> : null}
          {state.fieldErrors?.pickupTime ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.pickupTime}</p> : null}
        </fieldset>
      )}

      {chosen ? (
        <PayChoice
          methods={payMethods}
          selected={paymentMethod}
          onSelect={setPaymentMethod}
          cardPaymentUrl={firstText(contacts, (item) => item.cardPaymentUrl)}
          interacEmail={firstText(contacts, (item) => item.interacEmail)}
          venmoUsername={firstText(contacts, (item) => item.venmoUsername)}
          zelleMode={contacts.find((item) => item.zelleContact)?.zelleMode ?? "phone"}
          zelleContact={firstText(contacts, (item) => item.zelleContact)}
          error={state.fieldErrors?.paymentMethod}
          empty={needsTransfer ? "Delivery and shipping have to be paid by transfer first. This seller has not set one up." : ""}
        />
      ) : null}

      {requireName ? (
        <label className="block">
          <span className={labelClass}>Name<span className="text-danger"> *</span></span>
          <input name="name" autoComplete="name" defaultValue={defaultName} className={inputClass} />
          {state.fieldErrors?.name ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.name}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="name" value={defaultName} />
      )}
      <label className="block">
        <span className={labelClass}>Email<span className="text-danger"> *</span></span>
        <input name="email" type="email" autoComplete="email" defaultValue={defaultEmail} className={inputClass} />
        {state.fieldErrors?.email ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.email}</span> : null}
      </label>
      {requirePhone ? (
        <label className="block">
          <span className={labelClass}>Phone<span className="text-danger"> *</span></span>
          <input name="phone" type="tel" autoComplete="tel" className={inputClass} />
          {state.fieldErrors?.phone ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.phone}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="phone" value="" />
      )}
      {chosen && chosen.id !== "pickup" ? (
        <label className="block">
          <span className={labelClass}>Address<span className="text-danger"> *</span></span>
          <textarea name="address" rows={3} autoComplete="street-address" className={`${inputClass} h-auto py-3`} />
          {state.fieldErrors?.address ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.address}</span> : null}
        </label>
      ) : (
        <input type="hidden" name="address" value="" />
      )}

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
      <button disabled={pending || available.length === 0 || !chosen || needsTransfer} className={`${buttonClass} h-14 w-full rounded-2xl text-lg`}>
        {pending ? "Sending…" : "Place order"}
      </button>
    </form>
  );
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
