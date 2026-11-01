import Link from "next/link";
import { notFound } from "next/navigation";
import { closeOrderDispute, completeSellerPayout, openOrderDispute, startSellerPayout } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getOrder, getProductById, listLedger } from "@/lib/db";
import { formatSignedMoney } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/ledger";
import { OrderPaymentFacts } from "@/components/order-payment-facts";
import { buttonClass, ghostClass } from "@/components/ui";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const order = getOrder(id);
  if (!order) notFound();
  const product = getProductById(order.productId);
  const ledger = listLedger(order.id);
  const error = typeof query.error === "string" ? query.error : "";
  const next = `/admin/payments/${order.id}`;
  const checkout = order.paymentFlow === "twigigi_checkout";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <Link href="/admin/payments" className="text-sm text-forest">Payments</Link>
      <h1 className="mt-3 font-serif text-4xl">{order.publicRef || order.id}</h1>
      <p className="mt-1 text-sm text-muted">{order.displayName} · {order.buyerName}</p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="mt-6 rounded-3xl border border-line bg-card p-5">
        <OrderPaymentFacts order={order} cardPaymentUrl={product?.cardPaymentUrl ?? ""} />
        {order.disputeStatus === "open" ? <p className="mt-4 text-sm text-muted">Dispute note: open. This does not mean Twigigi is holding the payment.</p> : null}
      </section>

      {ledger.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Historical ledger</h2>
          <p className="mt-1 text-sm text-muted">These lines were recorded before direct payments were separated. They are not included in Marketplace GMV or Twigigi Platform Revenue, and they are not a seller payable.</p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline">
                <span className="font-medium">{entry.entryType}</span>
                <span className="text-muted">{ACCOUNT_LABEL[entry.account] ?? entry.account} · {entry.memo}</span>
                <span>{formatSignedMoney(entry.amountCents, entry.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {checkout ? (
          <>
            <form action={startSellerPayout}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="next" value={next} />
              <button className={buttonClass}>Start payout</button>
            </form>
            <form action={completeSellerPayout}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="next" value={next} />
              <button className={buttonClass}>Mark paid out</button>
            </form>
          </>
        ) : null}
        {order.disputeStatus === "open" ? (
          <form action={closeOrderDispute}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={ghostClass}>Close dispute note</button>
          </form>
        ) : (
          <form action={openOrderDispute}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={ghostClass}>Record dispute note</button>
          </form>
        )}
      </div>
    </main>
  );
}
