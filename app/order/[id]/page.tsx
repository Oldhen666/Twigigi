import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyOrderNumber } from "@/components/copy-order-number";
import { PrintReceipt } from "@/components/print-receipt";
import { SellerContactButton } from "@/components/seller-contact";
import { InteractionLine } from "@/components/interaction-line";
import { PayMethods } from "@/components/pay-methods";
import { BuyerPay } from "@/components/buyer-pay";
import { ReviewSeller } from "@/components/review-seller";
import { Stage } from "@/components/stage";
import { buttonClass } from "@/components/ui";
import { ReloadForm } from "@/components/reload-form";
import { acceptSellerChange, confirmBuyerPickup, confirmReceipt } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { findUserById, getInteractionBySource, getOrder, getProductById, hasReview } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { formatPickupChoice, formatClockMinutes, parsePickupChoice } from "@/lib/pickup";
import { buyerOrderCopy, buyerPlacement, fulfillmentDone } from "@/lib/order-flow";
import { buyerPayUrl, isCashMethod, methodLabel, methodsForFulfillment, safeEmail, safePhone } from "@/lib/payments";
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
  const placement = !digital && !canceled && order.reviewState !== "changes" && order.buyerPayment ? buyerPlacement(order) : null;
  const showPlaced = Boolean(placement);
  const title = placement?.title ?? copy.title;
  const badge = placement?.badge ?? copy.badge;
  const intro = placement?.intro ?? copy.intro;
  const summaryLines = showPlaced
    ? order.lines.length > 0
      ? order.lines.map((line) => ({
          key: `${line.productId}-${line.variantLabel}`,
          title: line.variantLabel ? `${line.title} · ${line.variantLabel}` : line.title,
          quantity: line.quantity,
          amount: formatMoney(line.subtotalCents, order.currency),
          image: lineImage(line.productId, product),
        }))
      : [{
          key: order.productId,
          title: order.variantLabel ? `${order.productTitle} · ${order.variantLabel}` : order.productTitle,
          quantity: order.quantity,
          amount: formatMoney(order.totalCents || order.amountCents, order.currency),
          image: product?.images[0] ?? "",
        }]
    : [];
  const whenLabel = order.fulfillment === "pickup" ? shortPickup(order.pickupWindow, product?.pickupTime ?? "") : "";
  const pickupAt = order.fulfillment === "pickup" ? cashPickupAt(order.pickupWindow) : "";
  const cashPickup = isCashMethod(order.buyerPayment) && order.fulfillment === "pickup";
  const delivered = order.fulfillmentState === "handed" || order.status === "fulfilled";
  const readyForPickup = delivered || order.fulfillmentState === "ready";
  const pickupConfirmed = Boolean(order.pickupConfirmedAt) || readyForPickup;
  const awaitingBuyerPickup = cashPickup && !canceled && !readyForPickup && !order.pickupConfirmedAt && order.pickupProposedBy === "seller";
  const currentStep = placement?.steps.find((step) => step.state === "current");
  const nextLine = !placement
    ? ""
    : awaitingBuyerPickup
      ? pickupAt
        ? `Confirm pickup for ${pickupAt}.`
        : "Confirm the pickup time the seller suggested."
      : cashPickup && !pickupConfirmed
        ? "Waiting for the seller to confirm your pickup time."
      : cashPickup && !readyForPickup
        ? pickupAt
          ? `Pickup is scheduled for ${pickupAt}.`
          : "The seller confirmed the pickup time."
        : cashPickup && !delivered
          ? paid
            ? "The seller confirmed the cash. Pick up the item when it is handed over."
            : "The seller is ready. Pay in cash when you pick it up."
          : currentStep
            ? `Next step: ${currentStep.detail}`
            : "";
  const receiptRows = [
    { label: "Status", value: badge },
    ...summaryLines.map((line) => ({
      label: "Item",
      value: `${line.title} · Qty ${line.quantity} · ${line.amount} ${order.currency}`,
    })),
    { label: "Fulfillment", value: fulfillmentLabel },
    { label: "Payment", value: methodLabel(order.buyerPayment) },
    { label: "Location", value: place },
    { label: "Time", value: whenLabel },
    { label: "Delivery instructions", value: order.deliveryNote },
    { label: "Note to seller", value: order.buyerNote },
    { label: "Seller", value: order.displayName },
    { label: "Buyer", value: order.buyerName },
    { label: "Ordered", value: formatDate(order.createdAt, order.productLocation) },
  ].filter((row) => row.value);
  return (
    <Stage>
      <div className={showPlaced ? "px-4 py-6" : "bg-card px-5 py-8 sm:rounded-[28px] sm:px-6"}>
        {showPlaced && placement ? (
          <>
            <h1 className="sr-only">{title}</h1>
            <section className="rounded-3xl border border-line bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{orderNumber ? `Order #${orderNumber}` : "Order"}</p>
                <span className="shrink-0 rounded-full bg-[#f4e7d4] px-2.5 py-1 text-xs font-medium text-[#8a5a2b]">{badge}</span>
              </div>
              <div className="mt-4 space-y-4">
                {summaryLines.map((line) => (
                  <div key={line.key} className="flex gap-3">
                    {line.image ? (
                      <img src={line.image} alt="" className="size-16 shrink-0 rounded-2xl border border-line object-cover" />
                    ) : (
                      <span className="size-16 shrink-0 rounded-2xl border border-line bg-paper-deep" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium leading-5">{line.title}</p>
                      <p className="mt-1 text-sm text-muted">Qty {line.quantity} · {fulfillmentLabel}</p>
                      <p className="mt-1 text-lg font-semibold">{line.amount} {order.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-4 text-sm text-muted">
                <div className="space-y-3">
                  {place ? <p className="flex items-center gap-2"><PinIcon /><span className="text-ink">{place}</span></p> : null}
                  {whenLabel ? <p className="flex items-center gap-2"><CalendarIcon /><span className="text-ink">{whenLabel}</span></p> : null}
                  {order.deliveryNote ? <p>Delivery instructions: {order.deliveryNote}</p> : null}
                  {order.buyerNote ? <p>Note to seller: {order.buyerNote}</p> : null}
                </div>
                <PrintReceipt orderNumber={orderNumber} rows={receiptRows} />
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-line bg-white px-4 py-5">
              <h2 className="font-semibold">Order progress</h2>
              <ol className="mt-5 grid grid-cols-3 text-center">
                {placement.steps.map((step) => (
                  <li key={step.title} className="flex flex-col items-center gap-2">
                    <ProgressMark state={step.state} />
                    <span className={`text-sm ${step.state === "upcoming" ? "text-muted" : "font-medium"}`}>{shortStep(step.title)}</span>
                  </li>
                ))}
              </ol>
              {nextLine ? <p className="mt-4 text-center text-sm text-muted">{nextLine}</p> : null}
              {awaitingBuyerPickup ? (
                <ReloadForm action={confirmBuyerPickup} className="mt-4">
                  <input type="hidden" name="id" value={order.id} />
                  <button className={`${buttonClass} w-full`}>Confirm this time</button>
                </ReloadForm>
              ) : null}
            </section>

            {!paid && product && isCashMethod(order.buyerPayment) ? (
              <section className="mt-4 rounded-3xl border border-line bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Pay the seller</h2>
                  <p className="text-sm text-muted">Cash on pickup</p>
                </div>
                <p className="mt-3 text-sm leading-6">Pay {formatMoney(order.totalCents || order.amountCents, order.currency)} in cash at pickup.</p>
              </section>
            ) : null}
            {!paid && product && !isCashMethod(order.buyerPayment) ? (
              <BuyerPay
                orderId={order.id}
                methods={[order.buyerPayment]}
                cardPaymentUrl={buyerPayUrl(product.cardPaymentUrl, {
                  amountCents: order.totalCents || order.amountCents,
                  currency: order.currency,
                  itemName: order.productTitle,
                })}
                interacEmail={product.interacEmail}
                interacQuestion={order.interacQuestion || product.interacQuestion}
                interacPassword={order.interacPassword || product.interacPassword}
                venmoUsername={product.venmoUsername}
                paypalMe={product.paypalMe}
                amountCents={order.totalCents || order.amountCents}
                currency={order.currency}
                orderNote={order.publicRef ? `Order ${order.publicRef}` : ""}
                orderRef={order.publicRef}
                variant="sheet"
                reported={order.paymentStatus === "verifying"}
              />
            ) : null}

            {!paid ? (
              <p className="mt-4 flex gap-2 text-sm leading-6 text-muted">
                <AlertIcon />
                <span>
                  {isCashMethod(order.buyerPayment)
                    ? "Cash payments are made directly to the seller, not through Twigigi."
                    : "You pay the seller directly. Twigigi does not hold or guarantee payments. Be cautious when paying before receiving an item."}
                </span>
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-center gap-3">
              <SellerContactButton mode={contact.mode} value={contact.value} variant="link" />
              {orderNumber ? <span className="text-muted" aria-hidden>·</span> : null}
              {orderNumber ? <CopyOrderNumber value={orderNumber} variant="link" /> : null}
            </div>
          </>
        ) : (
          <>
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

        {copy.next.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-serif text-2xl">What happens next?</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
              {copy.next.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        ) : null}
          </>
        )}

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

        {fulfillmentDone(order.fulfillmentState) && !order.buyerReceivedAt && !canceled ? (
          <form action={confirmReceipt} className="mt-4">
            <input type="hidden" name="id" value={order.id} />
            <button className={`${buttonClass} w-full`}>Confirm item received</button>
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
        {!paid && !canceled && order.reviewState === "accepted" && product && !order.buyerPayment && !digital ? (
          <BuyerPay
            orderId={order.id}
            methods={methodsForFulfillment(product.paymentMethods, order.fulfillment === "delivery" || order.fulfillment === "shipping" ? order.fulfillment : "pickup")}
            cardPaymentUrl={buyerPayUrl(product.cardPaymentUrl, {
              amountCents: order.totalCents || order.amountCents,
              currency: order.currency,
              itemName: order.productTitle,
            })}
            interacEmail={product.interacEmail}
            interacQuestion={product.interacQuestion}
            interacPassword={product.interacPassword}
            venmoUsername={product.venmoUsername}
            paypalMe={product.paypalMe}
            amountCents={order.totalCents || order.amountCents}
            currency={order.currency}
            orderNote={order.publicRef ? `Order ${order.publicRef}` : ""}
          />
        ) : null}
        {!paid && !canceled && order.reviewState === "accepted" && product && order.buyerPayment && !showPlaced ? (
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
            orderNote={order.publicRef ? `Order ${order.publicRef}` : ""}
            showContacts
          />
        ) : null}

        {interaction && buyerOwns && !showPlaced ? (
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

        {order.shipTracking ? (
          <p className="mt-4 text-sm">Shipped with {order.shipCarrier}. Tracking number: {order.shipTracking}</p>
        ) : null}
        {showPlaced ? null : (
          <>
            {orderNumber ? <div className="mt-6"><CopyOrderNumber value={orderNumber} /></div> : null}
            <Link href={trackHref} className={`${buttonClass} mt-3 w-full`}>Track your order</Link>
            {!account ? (
              <p className="mt-2 text-center text-sm text-muted">
                Use this email to find the order in your account. Already have one?{" "}
                <Link href={`/login?next=${encodeURIComponent("/orders")}`} className="text-forest">Log in</Link>
              </p>
            ) : null}
            <SellerContactButton mode={contact.mode} value={contact.value} />
          </>
        )}
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

function shortPickup(chosen: string, offered: string) {
  const parsed = parsePickupChoice(chosen);
  if (!parsed) return pickupWhen(chosen, offered);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${label} · ${formatClockMinutes(parsed.minutes)}`;
}

function cashPickupAt(chosen: string) {
  const parsed = parsePickupChoice(chosen);
  if (!parsed) return "";
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${label} at ${formatClockMinutes(parsed.minutes)}`;
}

function lineImage(productId: string, product: { id: string; images: string[] } | null) {
  if (product?.id === productId) return product.images[0] ?? "";
  return getProductById(productId)?.images[0] ?? "";
}

function shortStep(title: string) {
  const labels: Record<string, string> = {
    "Order placed": "Placed",
    "Pay the seller": "Payment",
    "Payment sent": "Payment",
    "Payment confirmed": "Payment",
    "Seller verification": "Verified",
    "Cash received": "Payment",
    "Cash at pickup": "Cash",
    Pickup: "Pickup",
    "Pickup requested": "Pickup requested",
    "Confirm pickup": "Confirm time",
    Complete: "Complete",
    Fulfillment: "Delivery",
    Delivered: "Delivered",
  };
  return labels[title] ?? title;
}

function ProgressMark({ state }: { state: "done" | "current" | "upcoming" }) {
  const tone = state === "done" ? "bg-forest text-card" : state === "current" ? "bg-[#f4e7d4] text-[#8a5a2b]" : "bg-paper-deep text-muted";
  return (
    <span className={`grid size-9 place-items-center rounded-full ${tone}`} aria-hidden>
      {state === "current" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.2 6.2h11.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.2 6.4 11 12.5 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
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
