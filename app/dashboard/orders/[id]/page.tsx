import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sendOrderFile, rollbackOrder } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { getOrder, getProductById } from "@/lib/db";
import { formatMoney, orderHeading, pickupTimes } from "@/lib/format";
import { timeZoneForLocation } from "@/lib/places";
import { formatPickupChoice } from "@/lib/pickup";
import { CopyText } from "@/components/copy-text";
import { buttonClass } from "@/components/ui";
import { OrderPaymentFacts } from "@/components/order-payment-facts";
import { OrderTrack } from "@/components/order-track";
import { ReloadForm } from "@/components/reload-form";
import { SellerOrderFlow } from "@/components/seller-order-flow";
import { orderRollbackTarget, orderTrack } from "@/lib/order-flow";
import { isCashMethod } from "@/lib/payments";

async function OrderScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const { id } = await params;
  const query = await searchParams;
  const fileNote = typeof query.file === "string" ? query.file : "";
  const mail = typeof query.mail === "string" ? query.mail : "";
  const order = getOrder(id);
  if (!order || order.sellerId !== user.id) notFound();
  const product = getProductById(order.productId);
  const scheduleIds = [...new Set((order.lines.length > 0 ? order.lines.map((line) => line.productId) : [order.productId]).filter(Boolean))];
  const pickupSchedules = scheduleIds.map((productId) => (productId === product?.id ? product?.pickupTime : getProductById(productId)?.pickupTime) ?? "");
  const pickupLists = pickupSchedules.map((schedule) => pickupTimes(schedule));
  const pickupSummary = pickupLists.every((list) => list.join("|") === (pickupLists[0]?.join("|") ?? "")) ? pickupLists[0] ?? [] : [];
  const backTo = orderRollbackTarget(order);
  const cashPickup = isCashMethod(order.buyerPayment) && order.fulfillment === "pickup";
  const fulfillWord = order.fulfillment === "pickup" ? "Local pickup" : order.fulfillment === "delivery" ? "Local delivery" : order.fulfillment === "shipping" ? "Shipping" : "Digital file";
  const ordered = orderedWhen(order.createdAt, order.productLocation);
  const buyerLines = [
    order.buyerName,
    [order.email, order.phone].filter(Boolean).join(" · "),
    order.address,
    order.deliveryNote ? `Delivery instructions: ${order.deliveryNote}` : "",
    order.buyerNote ? `Note to seller: ${order.buyerNote}` : "",
    order.fulfillment === "pickup" && product?.pickupNote ? `Pickup location: ${product.pickupNote}` : "",
    order.pickupWindow ? `Pickup time: ${formatPickupChoice(order.pickupWindow)}` : "",
    ordered,
  ].filter((line) => line.trim());
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <p className="text-sm text-muted">{order.publicRef}</p>
      <h1 className="mt-1 font-serif text-4xl">{orderHeading(order)}</h1>
      <OrderTrack steps={orderTrack(order)} />
      {backTo && !cashPickup ? (
        <ReloadForm action={rollbackOrder} className="mt-3">
          <input type="hidden" name="id" value={order.id} />
          <button className="text-sm text-forest">Roll back to {backTo}</button>
        </ReloadForm>
      ) : null}
      {order.lines.length > 1 ? (
        <div className="mt-4 space-y-1 text-sm">
          {order.lines.map((line) => (
            <p key={`${line.productId}-${line.variantLabel}`}>
              {line.title}{line.variantLabel ? ` · ${line.variantLabel}` : ""} · {line.quantity} × {formatMoney(line.unitCents, order.currency)}
            </p>
          ))}
          <p className="text-muted">Items {formatMoney(order.subtotalCents, order.currency)} · Shipping {order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, order.currency)}</p>
        </div>
      ) : order.variantLabel ? <p className="mt-2 text-muted">{order.variantLabel}</p> : null}
      <OrderPaymentFacts order={order} cardPaymentUrl={product?.cardPaymentUrl ?? ""} />
      <p className="mt-2 text-sm text-muted">{order.quantity} {order.quantity === 1 ? "item" : "items"} · {fulfillWord}</p>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{order.buyerName}</p>
          <p className="text-sm text-muted">{order.email}{order.phone ? ` · ${order.phone}` : ""}</p>
          {order.address ? <p className="text-sm text-muted">{order.address}</p> : null}
          {order.deliveryNote ? <p className="text-sm text-muted">Delivery instructions: {order.deliveryNote}</p> : null}
          {order.buyerNote ? <p className="text-sm text-muted">Note to seller: {order.buyerNote}</p> : null}
          {order.fulfillment === "pickup" && product?.pickupNote ? <p className="text-sm text-muted">Pickup location: {product.pickupNote}</p> : null}
          {order.pickupWindow ? <p className="text-sm text-muted">Pickup time: {formatPickupChoice(order.pickupWindow)}</p> : null}
        </div>
        <CopyText value={buyerLines.join("\n")} />
      </div>
      {order.fulfillment === "digital" ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4 text-sm">
          <p className="text-muted">
            {order.status === "paid" || order.status === "fulfilled" || order.paymentStatus === "paid"
              ? `Payment is confirmed. The buyer was emailed a confirmation and your contact. Send the file to ${order.email} when you are ready.`
              : "After the money arrives, confirm the payment. Then email the file link and password to the buyer."}
          </p>
          {fileNote === "sent" ? <p className="mt-2 text-forest">The file link and password were emailed to {order.email}.</p> : null}
          {fileNote === "mail" ? <p className="mt-2 text-danger">The email could not be sent. Check the mail settings, then try again.</p> : null}
          {fileNote === "wait" ? <p className="mt-2 text-danger">Confirm the payment before emailing the file.</p> : null}
          {(order.reviewState === "accepted" && (order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled")) ? (
            <ReloadForm action={sendOrderFile} className="mt-3">
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>{order.fileSentAt ? "Email the file link again" : "Email file link and password"}</button>
            </ReloadForm>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-muted">{ordered}</p>
      <SellerOrderFlow
        order={{
          ...order,
          interacQuestion: order.interacQuestion || (order.buyerPayment === "interac" ? product?.interacQuestion ?? "" : ""),
          interacPassword: order.interacPassword || (order.buyerPayment === "interac" ? product?.interacPassword ?? "" : ""),
        }}
        mail={mail}
        pickupSchedules={pickupSchedules}
        pickupSummary={pickupSummary}
      />
    </main>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading order…</p>}>
      <OrderScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Order", robots: { index: false, follow: false } };

function orderedWhen(iso: string, location: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Ordered ${iso}`;
  const zone = timeZoneForLocation(location);
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zone }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(date);
  return `Ordered ${day} at ${time}`;
}
