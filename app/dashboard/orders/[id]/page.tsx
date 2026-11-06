import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sendOrderFile } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { getOrder, getProductById } from "@/lib/db";
import { formatDate, formatMoney, orderHeading, srcLabel } from "@/lib/format";
import { formatPickupChoice } from "@/lib/pickup";
import { buttonClass } from "@/components/ui";
import { OrderPaymentFacts } from "@/components/order-payment-facts";
import { SellerOrderFlow } from "@/components/seller-order-flow";

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
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <p className="text-sm text-muted">{order.publicRef}</p>
      <h1 className="mt-1 font-serif text-4xl">{orderHeading(order)}</h1>
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
      <p className="mt-2 text-sm text-muted">{order.quantity} · {order.fulfillment === "digital" ? "digital file" : order.fulfillment}</p>
      <p className="mt-4 text-sm">{order.buyerName}</p>
      <p className="text-sm text-muted">{order.email}{order.phone ? ` · ${order.phone}` : ""}</p>
      {order.address ? <p className="text-sm text-muted">{order.address}</p> : null}
      {order.deliveryNote ? <p className="text-sm text-muted">Delivery instructions: {order.deliveryNote}</p> : null}
      {order.buyerNote ? <p className="text-sm text-muted">Note to seller: {order.buyerNote}</p> : null}
      {order.fulfillment === "pickup" && product?.pickupNote ? <p className="text-sm text-muted">Pickup location: {product.pickupNote}</p> : null}
      {order.pickupWindow ? <p className="text-sm text-muted">Pickup time: {formatPickupChoice(order.pickupWindow)}</p> : null}
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
            <form action={sendOrderFile} className="mt-3">
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>{order.fileSentAt ? "Email the file link again" : "Email file link and password"}</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-muted">{srcLabel(order.src)} · {formatDate(order.createdAt, order.productLocation)}</p>
      <SellerOrderFlow
        order={{
          ...order,
          interacQuestion: order.interacQuestion || (order.buyerPayment === "interac" ? product?.interacQuestion ?? "" : ""),
          interacPassword: order.interacPassword || (order.buyerPayment === "interac" ? product?.interacPassword ?? "" : ""),
        }}
        mail={mail}
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
