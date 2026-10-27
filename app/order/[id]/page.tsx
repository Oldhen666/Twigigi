import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Stage } from "@/components/stage";
import { PayMethods } from "@/components/pay-methods";
import { getCurrentUser } from "@/lib/auth";
import { getOrder, getProductById } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { methodsForFulfillment, safeEmail, safePhone } from "@/lib/payments";
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
  const product = getProductById(order.productId);
  const paid = order.status === "paid" || order.status === "fulfilled";
  return (
    <Stage>
      <div className="bg-card px-6 py-10 sm:rounded-[28px]">
        <p className="text-sm text-clay">{paid ? "Payment received" : "Order sent"}</p>
        <h1 className="mt-2 font-serif text-4xl">{order.productTitle}</h1>
        {order.variantLabel ? <p className="mt-2 text-muted">{order.variantLabel}</p> : null}
        <p className="mt-4 text-muted">
          {order.quantity} × {order.fulfillment} · {formatMoney(order.amountCents, order.currency)}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {paid
            ? `${order.displayName} has your payment. They will follow up at ${order.email}.`
            : order.fulfillment === "pickup"
              ? `Pay ${order.displayName} when you pick up. They will follow up at ${order.email}.`
              : `Transfer the payment to ${order.displayName} first. They confirm it, then ship. They will follow up at ${order.email}.`}
        </p>
        {!paid && product?.cta === "buy" ? (
          <PayMethods
            methods={methodsForFulfillment(product.paymentMethods, order.fulfillment)}
            cardPaymentUrl={product.cardPaymentUrl}
            interacEmail={product.interacEmail}
            venmoUsername={product.venmoUsername}
            zelleMode={product.zelleMode}
            zelleContact={product.zelleContact}
            showContacts
          />
        ) : null}
        {product?.cta === "buy" ? <SellerReach mode={product.sellerContactMode} contact={product.sellerContact} name={order.displayName} /> : null}
        {account && account.id === order.buyerId ? (
          <p className="mt-6 text-sm">
            <Link href="/orders" className="text-forest">Your orders</Link>
            {order.status === "fulfilled" ? <> · <Link href="/reviews" className="text-forest">Write a review</Link></> : null}
          </p>
        ) : !order.buyerId ? (
          <p className="mt-6 text-sm text-muted">
            <Link href="/signup" className="text-forest">Create an account</Link> with this email to keep this order.
          </p>
        ) : null}
        <Link href={`/${order.username}/${order.productSlug}`} className="mt-8 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
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
