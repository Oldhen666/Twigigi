import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyOrderNumber } from "@/components/copy-order-number";
import { SellerContactButton } from "@/components/seller-contact";
import { InteractionLine } from "@/components/interaction-line";
import { PayMethods } from "@/components/pay-methods";
import { ReviewSeller } from "@/components/review-seller";
import { Stage } from "@/components/stage";
import { buttonClass } from "@/components/ui";
import { acceptSellerChange, confirmReceipt } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { findUserById, getInteractionBySource, getOrder, getProductById, hasReview } from "@/lib/db";
import { formatMoney, orderHeading } from "@/lib/format";
import { formatPickupChoice, parsePickupChoice } from "@/lib/pickup";
import { buyerOrderCopy, fulfillmentDone } from "@/lib/order-flow";
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
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  const canceled = order.status === "canceled" || order.reviewState === "declined";
  const digital = product?.cta === "file" || order.fulfillment === "digital";
  const copy = buyerOrderCopy(order);
  const question = order.interacQuestion || (order.buyerPayment === "interac" ? product?.interacQuestion ?? "" : "");
  const password = order.interacPassword || (order.buyerPayment === "interac" ? product?.interacPassword ?? "" : "");
  const buyerOwns = Boolean(account && (account.id === order.buyerId || account.email.toLowerCase() === order.email.toLowerCase() || (interaction && (account.id === interaction.buyerId || account.email.toLowerCase() === interaction.buyerEmail))));
  const fileReady = Boolean(order.fileSentAt) && order.fileLinks.length > 0;
  const orderNumber = order.publicRef || interaction?.publicRef || "";
  const itemCount = order.lines.length > 0 ? order.lines.reduce((sum, line) => sum + line.quantity, 0) : order.quantity;
  const fulfillmentLabel = digital
    ? "Digital file"
    : order.fulfillment === "pickup"
      ? "Local pickup"
      : order.fulfillment === "delivery"
        ? "Local delivery"
        : "Shipping";
  const place = order.fulfillment === "pickup" ? product?.pickupNote.trim() ?? "" : order.address;
  const when = order.fulfillment === "pickup" ? pickupWhen(order.pickupWindow, product?.pickupTime ?? "") : "";
  const trackHref = account
    ? "/orders"
    : `/signup?email=${encodeURIComponent(order.email)}&next=${encodeURIComponent("/orders")}`;
  const contact = sellerContact(product, seller?.email ?? "", digital);
  const title = copy.title;
  const badge = copy.badge;
  const intro = copy.intro;
  return (
    <Stage>
      <div className="bg-card px-5 py-8 sm:rounded-[28px] sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-card">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-forest text-card" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {title}
        </p>
        <p className="mt-4 text-sm leading-6 text-ink">{intro}</p>

        <section className="mt-4 rounded-2xl bg-ink px-4 py-4 text-card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-card/70">{orderNumber ? `Order #${orderNumber}` : "Order"}</p>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${canceled ? "bg-card/15 text-card" : order.reviewState === "requested" || order.reviewState === "changes" ? "bg-clay/20 text-clay" : "bg-moss text-forest"}`}>{badge}</span>
          </div>
          <h1 className="mt-4 font-serif text-2xl leading-tight">{orderHeading(order)}</h1>
          {order.lines.length > 1 ? (
            <div className="mt-3 space-y-1 text-sm text-card/80">
              {order.lines.map((line) => (
                <p key={`${line.productId}-${line.variantLabel}`}>
                  {line.title}{line.variantLabel ? ` · ${line.variantLabel}` : ""} · {line.quantity}
                </p>
              ))}
            </div>
          ) : order.variantLabel ? <p className="mt-2 text-sm text-card/70">{order.variantLabel}</p> : null}
          <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-card/80">{itemCount === 1 ? "1 item" : `${itemCount} items`} · {fulfillmentLabel}</span>
            <span className="text-base">{formatMoney(order.totalCents || order.amountCents, order.currency)}</span>
          </p>
          {place || when || order.deliveryNote || order.buyerNote ? (
            <div className="mt-4 space-y-2 border-t border-card/15 pt-4 text-sm text-card/90">
              {place ? <p className="flex gap-2"><PinIcon /><span>{place}</span></p> : null}
              {when ? <p className="flex gap-2"><CalendarIcon /><span>{when}</span></p> : null}
              {order.deliveryNote ? <p>Delivery instructions: {order.deliveryNote}</p> : null}
              {order.buyerNote ? <p>Note to seller: {order.buyerNote}</p> : null}
            </div>
          ) : null}
        </section>

        {order.reviewState === "changes" && !canceled ? (
          <section className="mt-6 rounded-2xl border border-line p-4 text-sm">
            <h2 className="font-serif text-2xl">Proposed change</h2>
            <p className="mt-2">{order.proposalNote}</p>
            {order.proposalCents > 0 ? <p className="mt-2">New total: {formatMoney(order.proposalCents, order.currency)}</p> : <p className="mt-2 text-muted">The total stays {formatMoney(order.totalCents || order.amountCents, order.currency)}.</p>}
            <form action={acceptSellerChange} className="mt-3">
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>Accept change</button>
            </form>
          </section>
        ) : null}

        {copy.next.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-serif text-2xl">What happens next?</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
              {copy.next.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        ) : null}

        {fulfillmentDone(order.fulfillmentState) && !order.buyerReceivedAt && !canceled ? (
          <form action={confirmReceipt} className="mt-4">
            <input type="hidden" name="id" value={order.id} />
            <button className={`${buttonClass} w-full`}>Confirm receipt</button>
            {account ? null : <p className="mt-2 text-center text-sm text-muted">Sign in with this email afterwards to review the seller.</p>}
          </form>
        ) : null}

        {interaction && buyerOwns && fulfillmentDone(order.fulfillmentState) ? (
          <ReviewSeller
            interactionId={interaction.id}
            kind="order"
            productTitle={orderHeading(order)}
            reviewed={hasReview(interaction.id)}
          />
        ) : null}

        {fileReady ? (
          <div className="mt-4 space-y-2 rounded-2xl bg-paper-deep px-4 py-3 text-sm">
            {order.fileLinks.map((link) => (
              <p key={link}>
                <a href={link} className="break-all text-forest" target="_blank" rel="noreferrer">{link}</a>
              </p>
            ))}
            {order.filePassword ? <p>Password: {order.filePassword}</p> : null}
          </div>
        ) : null}
        {!paid && !canceled && order.reviewState === "accepted" && product ? (
          <PayMethods
            methods={(() => {
              const fulfillment = order.fulfillment === "delivery" || order.fulfillment === "shipping" ? order.fulfillment : "pickup";
              const offered = digital ? ["card"] : methodsForFulfillment(product.paymentMethods, fulfillment);
              return order.buyerPayment && offered.includes(order.buyerPayment) ? [order.buyerPayment] : offered;
            })()}
            cardPaymentUrl={buyerPayUrl(product.cardPaymentUrl, {
              amountCents: order.totalCents || order.amountCents,
              currency: order.currency,
              itemName: order.productTitle,
            })}
            interacEmail={product.interacEmail}
            interacQuestion={question}
            interacPassword={password}
            venmoUsername={product.venmoUsername}
            paypalMe={product.paypalMe}
            amountCents={order.totalCents || order.amountCents}
            currency={order.currency}
            zelleMode={product.zelleMode}
            zelleContact={product.zelleContact}
            showContacts
          />
        ) : null}

        {interaction && buyerOwns ? (
          <div className="mt-6">
            <InteractionLine
              item={interaction}
              nextPath={`/order/${order.id}`}
              side="buyer"
              showReview={false}
              allowConfirm={false}
            />
          </div>
        ) : null}

        {orderNumber ? <div className="mt-6"><CopyOrderNumber value={orderNumber} /></div> : null}
        <Link href={trackHref} className={`${buttonClass} mt-3 w-full`}>Track your order</Link>
        {!account ? (
          <p className="mt-2 text-center text-sm text-muted">
            Use this email to find the order in your account. Already have one?{" "}
            <Link href={`/login?next=${encodeURIComponent("/orders")}`} className="text-forest">Log in</Link>
          </p>
        ) : null}
        <SellerContactButton mode={contact.mode} value={contact.value} />
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

function pickupWhen(chosen: string, offered: string) {
  if (parsePickupChoice(chosen)) return formatPickupChoice(chosen);
  const sentence = chosen.trim() || offered.split("|").map((item) => item.trim()).filter(Boolean).join(" · ");
  return sentence ? `${sentence} · Exact time pending` : "";
}

function sellerContact(
  product: { cta: string; sellerContactMode: "phone" | "email"; sellerContact: string } | null,
  sellerEmail: string,
  digital: boolean,
) {
  const mode = digital && product && !product.sellerContact.trim() ? "email" : product?.sellerContactMode ?? "email";
  const contact = digital ? product?.sellerContact.trim() || sellerEmail : product?.sellerContact ?? "";
  const email = mode === "email" ? safeEmail(contact) : "";
  const phone = mode === "phone" ? safePhone(contact) : "";
  if (email) return { mode: "email" as const, value: email };
  if (phone) return { mode: "phone" as const, value: phone };
  return { mode: "" as const, value: "" };
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <path d="M8 14s4.5-4.1 4.5-7.2A4.5 4.5 0 0 0 3.5 6.8C3.5 9.9 8 14 8 14Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="6.7" r="1.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <rect x="2.2" y="3.2" width="11.6" height="10.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 6.4h11.6M5.2 2.2v2.2M10.8 2.2v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export const metadata = { title: "Order", robots: { index: false, follow: false } };
