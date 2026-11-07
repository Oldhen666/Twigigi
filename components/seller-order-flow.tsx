import { ReloadForm } from "@/components/reload-form";
import { SellerPickupTime } from "@/components/seller-pickup-time";
import { arrangePickupTime, completeOrder, confirmOrderPayment, confirmPaymentAndHandover, confirmPickupTime, markOrderProgress, reviewSellerOrder, rollbackOrder } from "@/lib/actions";
import { formatDate, formatMoney } from "@/lib/format";
import { formatPickupChoice } from "@/lib/pickup";
import { isCashMethod, methodLabel } from "@/lib/payments";
import { ORDER_COMPLETE_DAYS, fulfillmentDone, orderCanComplete, orderRollbackTarget, paymentNeedsConfirm, shipsToBuyer } from "@/lib/order-flow";
import type { OrderRecord } from "@/lib/types";
import { buttonClass, ghostClass } from "@/components/ui";

export function SellerOrderFlow({
  order,
  mail,
  pickupSchedules = [],
  pickupSummary = [],
}: {
  order: OrderRecord;
  mail: string;
  pickupSchedules?: string[];
  pickupSummary?: string[];
}) {
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  const prepaid = paymentNeedsConfirm(order.buyerPayment);
  const closed = order.status === "canceled" || order.status === "fulfilled" || order.reviewState === "declined";
  const reviewing = !closed && (order.reviewState === "requested" || order.reviewState === "changes");
  const confirmed = order.reviewState === "accepted" && !closed;
  const digital = order.fulfillment === "digital";
  const canFulfill = confirmed && (!prepaid || paid) && !fulfillmentDone(order.fulfillmentState) && !digital;
  const canComplete = orderCanComplete(order);
  const readyDate = order.readyAt ? Date.parse(order.readyAt) : NaN;
  const opensAt = Number.isFinite(readyDate) ? new Date(readyDate + ORDER_COMPLETE_DAYS * 24 * 60 * 60 * 1000).toISOString() : "";
  const showInterac = order.buyerPayment === "interac" && Boolean(order.interacQuestion || order.interacPassword);
  if (isCashMethod(order.buyerPayment) && order.fulfillment === "pickup" && order.status !== "canceled" && order.reviewState !== "declined") {
    return <CashPickupSeller order={order} mail={mail} pickupSchedules={pickupSchedules} pickupSummary={pickupSummary} />;
  }
  if (!mail && !reviewing && !confirmed && order.reviewState !== "changes" && !showInterac) return null;
  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-4">
      {mail === "0" ? <p className="text-sm text-danger">The status was saved, but the email could not be sent.</p> : null}
      {mail === "ship" ? <p className="text-sm text-danger">Enter the carrier and a tracking number.</p> : null}
      {mail === "note" ? <p className="mt-3 text-sm text-danger">Describe the change in a few words.</p> : null}
      {mail === "amount" ? <p className="mt-3 text-sm text-danger">Enter a new total of at least $0.50, or leave it blank.</p> : null}
      {order.reviewState === "changes" ? (
        <div className="mt-3 rounded-2xl bg-paper-deep px-3 py-3 text-sm">
          <p>Waiting for the buyer to accept this change.</p>
          <p className="mt-1">{order.proposalNote}</p>
          {order.proposalCents > 0 ? <p className="mt-1">New total: {formatMoney(order.proposalCents, order.currency)}</p> : null}
        </div>
      ) : null}
      {reviewing ? (
        <div className="mt-4 space-y-3">
          <ReloadForm action={reviewSellerOrder}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="decision" value="accept" />
            <button className={buttonClass}>{order.reviewState === "changes" ? "Accept the original order" : "Accept order"}</button>
          </ReloadForm>
          <ReloadForm action={reviewSellerOrder} className="space-y-2">
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="decision" value="propose" />
            <label className="block text-sm">
              Propose a change
              <textarea name="proposalNote" maxLength={500} rows={3} placeholder="What should change?" className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              New total, if applicable
              <input name="proposalAmount" inputMode="decimal" placeholder="Leave blank to keep the current total" className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3" />
            </label>
            <button className="text-sm text-forest">Send change to buyer</button>
          </ReloadForm>
          <ReloadForm action={reviewSellerOrder}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="decision" value="decline" />
            <button className="text-sm text-danger">Decline order</button>
          </ReloadForm>
        </div>
      ) : null}
      {confirmed ? (
        <div className="mt-4 space-y-3 text-sm">
          <p>
            Payment:{" "}
            {paid
              ? `Confirmed${order.buyerPayment ? ` · ${methodLabel(order.buyerPayment) || order.buyerPayment}` : ""}`
              : order.paymentStatus === "verifying"
                ? "Buyer says they sent it. Confirm only after you see the money."
                : order.buyerPayment
                  ? prepaid
                    ? "Unpaid. The buyer has the payment details."
                    : "Cash on pickup. Unpaid until you confirm the cash."
                  : "Waiting for the buyer to choose a way to pay."}
          </p>
          <p>
            Fulfillment:{" "}
            {order.fulfillmentState === "ready"
              ? "Ready for pickup"
              : order.fulfillmentState === "sent"
                ? digital
                  ? order.fileSentAt
                    ? "File emailed"
                    : "Marked sent"
                  : order.shipTracking
                    ? `Sent with ${order.shipCarrier}. Tracking ${order.shipTracking}`
                    : "Sent out for delivery"
                : "Not yet"}
          </p>
          {confirmed && order.fulfillment === "pickup" && isCashMethod(order.buyerPayment) && !order.pickupConfirmedAt && !fulfillmentDone(order.fulfillmentState) ? (
            <ReloadForm action={confirmPickupTime}>
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>Confirm pickup time</button>
              <p className="mt-1 text-muted">The buyer asked for this time. Confirm it when that time works.</p>
            </ReloadForm>
          ) : null}
          {prepaid && !paid ? (
            <ReloadForm action={confirmOrderPayment}>
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>Payment received</button>
            </ReloadForm>
          ) : null}
          {!prepaid && !paid ? (
            <ReloadForm action={confirmOrderPayment}>
              <input type="hidden" name="id" value={order.id} />
              <button className="text-forest">Cash received</button>
            </ReloadForm>
          ) : null}
          {canFulfill && order.fulfillment === "pickup" ? (
            <ReloadForm action={markOrderProgress}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="state" value="ready" />
              <button className={buttonClass}>Ready for pickup</button>
              <p className="mt-1 text-muted">This emails the buyer that the order is ready for pickup.</p>
            </ReloadForm>
          ) : null}
          {canFulfill && shipsToBuyer(order.fulfillment) ? (
            <ReloadForm action={markOrderProgress} className="space-y-2">
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="state" value="sent" />
              <label className="block">
                Carrier
                <select name="carrier" defaultValue="Canada Post" className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3">
                  <option>Canada Post</option>
                  <option>UPS</option>
                  <option>FedEx</option>
                  <option>Purolator</option>
                  <option>USPS</option>
                  <option>DHL</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                Carrier name, if other
                <input name="carrierName" maxLength={40} className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3" />
              </label>
              <label className="block">
                Tracking number
                <input name="tracking" required minLength={4} maxLength={40} className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3" />
              </label>
              <button className={buttonClass}>Ship out</button>
              <p className="text-muted">This emails the buyer the carrier and tracking number.</p>
            </ReloadForm>
          ) : null}
          {prepaid && !paid && !digital ? <p className="text-muted">Confirm the payment before you mark it ready or sent.</p> : null}
          {fulfillmentDone(order.fulfillmentState) && !canComplete && !order.buyerReceivedAt ? (
            <p className="text-muted">
              The buyer can confirm receipt and leave a review.
              {opensAt ? ` You can complete the order after they do, or on ${formatDate(opensAt, order.productLocation)}.` : ` You can complete the order after they do, or ${ORDER_COMPLETE_DAYS} days after it was marked ready.`}
            </p>
          ) : null}
          {canComplete ? (
            <ReloadForm action={completeOrder}>
              <input type="hidden" name="id" value={order.id} />
              <button className={buttonClass}>Complete order</button>
              <p className="mt-1 text-muted">
                {order.buyerReceivedAt ? "The buyer confirmed receipt." : `${ORDER_COMPLETE_DAYS} days have passed since it was marked ready.`}
              </p>
            </ReloadForm>
          ) : null}
          <ReloadForm action={reviewSellerOrder}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="decision" value="decline" />
            <button className="text-danger">Cancel order</button>
          </ReloadForm>
        </div>
      ) : null}
      {showInterac ? (
        <div className="mt-4 text-sm">
          {order.interacQuestion ? <p>e-Transfer question: {order.interacQuestion}</p> : null}
          {order.interacPassword ? <p>e-Transfer password: {order.interacPassword}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function CashPickupSeller({
  order,
  mail,
  pickupSchedules,
  pickupSummary,
}: {
  order: OrderRecord;
  mail: string;
  pickupSchedules: string[];
  pickupSummary: string[];
}) {
  const completed = order.status === "fulfilled" || order.fulfillmentState === "handed";
  const ready = !completed && order.fulfillmentState === "ready";
  const paid = order.paymentStatus === "paid" || order.status === "paid" || completed;
  const when = order.pickupWindow ? formatPickupChoice(order.pickupWindow) : "the requested time";
  const backTo = orderRollbackTarget(order);
  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm">
      {mail === "0" ? <p className="mb-3 text-danger">The status was saved, but the email could not be sent.</p> : null}
      {order.reviewState === "changes" ? (
        <div className="mb-4 rounded-2xl bg-paper-deep px-3 py-3">
          <p>Waiting for the buyer to accept this change.</p>
          <p className="mt-1">{order.proposalNote}</p>
        </div>
      ) : null}
      {completed ? (
        <div>
          <p className="flex items-center gap-2 text-base font-medium"><span className="text-forest" aria-hidden>✓</span> Order completed</p>
          <p className="mt-2 text-muted">Cash received · Item handed over</p>
          <p className="mt-1 text-muted">The buyer may leave a review independently.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="font-medium">Next action</p>
            <p className="mt-1 leading-6 text-muted">
              {ready && paid
                ? "The cash is confirmed. Confirm the handover when the buyer collects the item."
                : ready
                  ? "When the buyer collects the item, confirm that you received the cash and handed over the item."
                  : order.pickupProposedBy === "seller" && order.pickupWindow
                    ? `Waiting for the buyer to confirm pickup on ${when}.`
                    : order.pickupConfirmedAt
                      ? `Pickup is scheduled for ${when}. Notify the buyer when the item is ready.`
                      : order.pickupWindow
                        ? `The buyer requested pickup on ${when}. Confirm the time or arrange another one.`
                        : "Suggest a pickup time for this order."}
            </p>
          </div>
          {ready && paid ? (
            <ReloadForm action={confirmPaymentAndHandover}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="handoverOnly" value="1" />
              <button className={`${buttonClass} w-full`}>Confirm handover</button>
            </ReloadForm>
          ) : null}
          {ready && !paid ? (
            <ReloadForm action={confirmPaymentAndHandover}>
              <input type="hidden" name="id" value={order.id} />
              <button className={`${buttonClass} w-full`}>Confirm payment & handover</button>
              <p className="mt-2 text-center text-muted">This will mark the order as paid and completed.</p>
            </ReloadForm>
          ) : null}
          {!ready && order.pickupConfirmedAt ? (
            <ReloadForm action={markOrderProgress}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="state" value="ready" />
              <button className={`${buttonClass} w-full`}>Mark ready for pickup</button>
            </ReloadForm>
          ) : null}
          {!ready && !order.pickupConfirmedAt && order.pickupWindow && order.pickupProposedBy !== "seller" ? (
            <ReloadForm action={confirmPickupTime}>
              <input type="hidden" name="id" value={order.id} />
              <button className={`${buttonClass} w-full`}>Confirm pickup time</button>
            </ReloadForm>
          ) : null}
          {!ready && !order.pickupConfirmedAt ? (
            <details className="rounded-2xl border border-line px-4 py-3">
              <summary className="cursor-pointer font-medium">Suggest another time</summary>
              <ReloadForm action={arrangePickupTime} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={order.id} />
                <SellerPickupTime schedules={pickupSchedules} summary={pickupSummary} value={order.pickupWindow} />
                <button className={`${ghostClass} w-full`}>Save this time</button>
              </ReloadForm>
            </details>
          ) : null}
          {ready ? (
            <details className="rounded-2xl border border-line px-4 py-3">
              <summary className="cursor-pointer font-medium">Reschedule pickup</summary>
              <ReloadForm action={arrangePickupTime} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="reschedule" value="1" />
                <SellerPickupTime schedules={pickupSchedules} summary={pickupSummary} value={order.pickupWindow} />
                <button className={`${ghostClass} w-full`}>Save this time</button>
              </ReloadForm>
            </details>
          ) : null}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        {!completed ? (
          <ReloadForm action={reviewSellerOrder}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="decision" value="decline" />
            <button className="text-danger">Cancel order</button>
          </ReloadForm>
        ) : <span />}
        {backTo || (ready && !paid) ? (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-line px-4 py-2">More actions</summary>
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-line bg-card p-2 shadow">
              {backTo ? (
                <ReloadForm action={rollbackOrder}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-paper">Change status to {backTo}</button>
                </ReloadForm>
              ) : null}
              {ready && !paid ? (
                <ReloadForm action={confirmOrderPayment}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-paper">Confirm cash received</button>
                </ReloadForm>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
