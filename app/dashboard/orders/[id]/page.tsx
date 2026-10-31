import { notFound } from "next/navigation";
import { Suspense } from "react";
import { confirmInteraction, setLeadStatus } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { getInteractionBySource, getOrder } from "@/lib/db";
import { formatDate, formatMoney, interactionLabel, srcLabel } from "@/lib/format";

async function OrderScreen({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSeller();
  const { id } = await params;
  const order = getOrder(id);
  if (!order || order.sellerId !== user.id) notFound();
  const interaction = getInteractionBySource(order.id);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <p className="text-sm text-muted">{order.publicRef}</p>
      <h1 className="mt-1 font-serif text-4xl">{order.productTitle}</h1>
      {order.variantLabel ? <p className="mt-2 text-muted">{order.variantLabel}</p> : null}
      <p className="mt-4 font-serif text-2xl">{formatMoney(order.amountCents, order.currency)}</p>
      <p className="mt-2 text-sm text-muted">{order.quantity} · {order.fulfillment === "digital" ? "digital file" : order.fulfillment} · {order.status}</p>
      <p className="mt-4 text-sm">{order.buyerName}</p>
      <p className="text-sm text-muted">{order.email}{order.phone ? ` · ${order.phone}` : ""}</p>
      {order.address ? <p className="text-sm text-muted">{order.address}</p> : null}
      {order.fulfillment === "digital" ? (
        <p className="mt-3 text-sm text-muted">
          {order.status === "paid" || order.status === "fulfilled"
            ? "Twigigi emailed the file link and password to the buyer."
            : "Mark this order paid after you receive the money. Twigigi then emails the file link and password."}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">{srcLabel(order.src)} · {formatDate(order.createdAt)}</p>
      <form action={setLeadStatus} className="mt-4 flex items-center gap-2">
        <input type="hidden" name="kind" value="order" />
        <input type="hidden" name="id" value={order.id} />
        <select name="status" defaultValue={order.status} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
          {["unpaid", "paid", "fulfilled", "canceled"].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button className="text-sm text-forest">Save</button>
      </form>
      {interaction ? (
        <section className="mt-8 rounded-2xl border border-line bg-card p-4 text-sm">
          <p className="font-medium">{interaction.publicRef}</p>
          <p className="text-muted">{interactionLabel(interaction)}</p>
          {interaction.sellerConfirmedAt ? null : (
            <form action={confirmInteraction} className="mt-2">
              <input type="hidden" name="id" value={interaction.id} />
              <input type="hidden" name="side" value="seller" />
              <input type="hidden" name="next" value={`/dashboard/orders/${order.id}`} />
              <button className="text-forest">Mark completed</button>
            </form>
          )}
        </section>
      ) : null}
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading order…</p>}>
      <OrderScreen params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Order", robots: { index: false, follow: false } };
