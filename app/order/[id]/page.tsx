import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Stage } from "@/components/stage";
import { PayMethods } from "@/components/pay-methods";
import { InteractionLine } from "@/components/interaction-line";
import { OrderPaymentFacts } from "@/components/order-payment-facts";
import { getCurrentUser } from "@/lib/auth";
import { findUserById, getInteractionBySource, getOrder, getProductById } from "@/lib/db";
import { formatMoney, orderHeading } from "@/lib/format";
import { buyerPayUrl, methodsForFulfillment, safeEmail, safePhone } from "@/lib/payments";
import { confirmStripeSession } from "@/lib/stripe";

async function OrderView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : null;
  if (sessionId) await confirmStripeSession(id, sessionId);
  const order = getOrder(id);
  if (!order) notFound();
  const account = await getCurrentUser();
  const interaction = getInteractionBySource(order.id);
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  const paid = order.status === "paid" || order.status === "fulfilled";
  const digital = product?.cta === "file" || order.fulfillment === "digital";
  const fileReady = Boolean(order.fileSentAt) && order.fileLinks.length > 0;
  return (
    <Stage>
      <div className="bg-card px-6 py-10 sm:rounded-[28px]">
        <p className="text-sm text-clay">{paid ? "Seller confirmed payment" : "Order sent"}</p>
        <h1 className="mt-2 font-serif text-4xl">{orderHeading(order)}</h1>
        {order.lines.length > 1 ? (
          <div className="mt-4 space-y-2 text-sm">
            {order.lines.map((line) => (
              <p key={`${line.productId}-${line.variantLabel}`}>
                <Link href={`/${order.publicId}/${line.slug}`} className="font-medium">{line.title}</Link>
                {line.variantLabel ? <span className="text-muted"> · {line.variantLabel}</span> : null}
                <span className="text-muted"> · {line.quantity} × {formatMoney(line.unitCents, order.currency)}</span>
              </p>
            ))}
            <p className="flex justify-between text-muted"><span>Items</span><span>{formatMoney(order.subtotalCents, order.currency)}</span></p>
            <p className="flex justify-between text-muted"><span>Shipping</span><span>{order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, order.currency)}</span></p>
            <p className="font-serif text-2xl text-forest">{formatMoney(order.totalCents, order.currency)}</p>
          </div>
        ) : (
          <>
            {order.variantLabel ? <p className="mt-2 text-muted">{order.variantLabel}</p> : null}
            <p className="mt-4 text-muted">
              {order.quantity} × {digital ? "digital file" : order.fulfillment} · {formatMoney(order.amountCents, order.currency)}
            </p>
          </>
        )}
        {order.fulfillment === "pickup" && product?.pickupNote ? <p className="mt-3 text-sm">Pickup location: {product.pickupNote}</p> : null}
        {order.pickupWindow ? <p className="mt-1 text-sm">Pickup time: {order.pickupWindow}</p> : null}
        <OrderPaymentFacts order={order} cardPaymentUrl={product?.cardPaymentUrl ?? ""} />
        <p className="mt-3 text-sm leading-6 text-muted">
          {digital
            ? fileReady
              ? `The file link and password were emailed to ${order.email}. They are also listed below.`
              : paid
                ? `Payment confirmed. A confirmation with the seller's contact was emailed to ${order.email}. The file link arrives when the seller sends it.`
                : `Pay ${formatMoney(order.totalCents || order.amountCents, order.currency)} to ${order.displayName} by card. After they confirm the payment, they email the file link and password to ${order.email}.`
            : paid
              ? `${order.displayName} confirmed your payment. They will follow up at ${order.email}.`
              : order.fulfillment === "pickup"
                ? `Pay ${order.displayName} directly when you pick up. They will follow up at ${order.email}.`
                : `Pay ${order.displayName} directly. They confirm it, then ship. They will follow up at ${order.email}.`}
        </p>
        {fileReady ? (
          <div className="mt-4 space-y-2 rounded-2xl bg-paper-deep px-4 py-3 text-sm">
            {order.fileLinks.map((link) => (
              <p key={link}>
                <a href={link} className="break-all text-forest" target="_blank" rel="noreferrer">
                  {link}
                </a>
              </p>
            ))}
            {order.filePassword ? <p>Password: {order.filePassword}</p> : null}
          </div>
        ) : null}
        {!paid && (product?.cta === "buy" || product?.cta === "file") ? (
          <PayMethods
            methods={(() => {
              const offered = methodsForFulfillment(product.paymentMethods, order.fulfillment === "digital" ? "pickup" : order.fulfillment);
              return order.buyerPayment && offered.includes(order.buyerPayment) ? [order.buyerPayment] : offered;
            })()}
            cardPaymentUrl={
              product.cta === "file"
                ? buyerPayUrl(product.cardPaymentUrl, {
                    amountCents: order.totalCents || order.amountCents,
                    currency: order.currency,
                    itemName: order.productTitle,
                  })
                : product.cardPaymentUrl
            }
            interacEmail={product.interacEmail}
            venmoUsername={product.venmoUsername}
            zelleMode={product.zelleMode}
            zelleContact={product.zelleContact}
            showContacts
          />
        ) : null}
        {product?.cta === "file" ? (
          <SellerReach
            mode={product.sellerContact.trim() ? product.sellerContactMode : "email"}
            contact={product.sellerContact.trim() || seller?.email || ""}
            name={order.displayName}
          />
        ) : product?.cta === "buy" ? (
          <SellerReach mode={product.sellerContactMode} contact={product.sellerContact} name={order.displayName} />
        ) : null}
        {interaction && account && (account.id === interaction.buyerId || account.email.toLowerCase() === interaction.buyerEmail) ? (
          <div className="mt-6"><InteractionLine item={interaction} nextPath={`/order/${order.id}`} side="buyer" /></div>
        ) : interaction && account && account.id === interaction.sellerId ? (
          <div className="mt-6"><InteractionLine item={interaction} nextPath={`/order/${order.id}`} side="seller" /></div>
        ) : interaction ? (
          <p className="mt-6 text-sm text-muted">{interaction.publicRef} · {interaction.buyerConfirmedAt && interaction.sellerConfirmedAt ? "Verified transaction" : interaction.buyerConfirmedAt ? "Buyer confirmed" : "Open"}</p>
        ) : null}
        {account && account.id === order.buyerId ? (
          <p className="mt-3 text-sm"><Link href="/orders" className="text-forest">Your orders/quotes</Link></p>
        ) : !order.buyerId ? (
          <p className="mt-6 text-sm text-muted">
            <Link href="/signup" className="text-forest">Create an account</Link> with this email to keep this order.
          </p>
        ) : null}
        <Link href={`/${order.publicId}/${order.productSlug}`} className="mt-8 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
          Back to the product
        </Link>
      </div>
    </Stage>
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
    <Suspense fallback={<p className="p-8 text-muted">Loading order…</p>}>
      <OrderView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function SellerReach({ mode, contact, name }: { mode: "phone" | "email"; contact: string; name: string }) {
  const email = mode === "email" ? safeEmail(contact) : "";
  const phone = mode === "phone" ? safePhone(contact) : "";
  const value = email || phone;
  if (!value) return null;
  return (
    <p className="mt-4 text-sm">
      Questions? Contact {name}:{" "}
      {email ? (
        <a className="text-forest" href={`mailto:${email}`}>
          {email}
        </a>
      ) : (
        <a className="text-forest" href={`tel:${phone.replace(/\D/g, "")}`}>
          {phone}
        </a>
      )}
    </p>
  );
}

export const metadata = { title: "Order", robots: { index: false, follow: false } };
