import Link from "next/link";
import { notFound } from "next/navigation";
import { closeOrderDispute, completeSellerPayout, openOrderDispute, startSellerPayout } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { allMoneyOrders, listLedger, platformBooks } from "@/lib/db";
import { formatDay, formatMoney, formatSignedMoney } from "@/lib/format";
import { ACCOUNT_LABEL, BUCKET_LABEL } from "@/lib/ledger";
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
  const order = allMoneyOrders().find((item) => item.id === id);
  if (!order) notFound();
  const ledger = listLedger(order.id);
  const books = platformBooks();
  const error = typeof query.error === "string" ? query.error : "";
  const where = order.bucket === "protected" || order.bucket === "available" ? "Safeguarded funds" : BUCKET_LABEL[order.bucket];
  const when =
    order.disputeStatus === "open"
      ? "Held until the dispute closes"
      : order.bucket === "paid"
        ? order.payoutCompletedAt
          ? `Paid out ${formatDay(order.payoutCompletedAt)}`
          : "Paid out"
        : order.bucket === "transit"
          ? "Already on the way"
          : order.bucket === "available"
            ? "Eligible now"
            : order.payoutEligibleAt
              ? formatDay(order.payoutEligibleAt)
              : "Not set";
  const facts = [
    ["Whose money", `${order.sellerName} receives ${formatMoney(order.sellerNetCents, order.currency)}. Twigigi keeps ${formatMoney(order.twigigiFeeCents, order.currency)}.`],
    ["Which order", order.publicRef],
    ["Where it is", where],
    ["When it should leave", when],
  ];
  const statement = [
    ["Buyer paid", order.buyerPaidCents],
    ["Processing fee", -order.stripeFeeCents],
    ["Twigigi fee", -order.twigigiFeeCents],
    ["Seller net", order.sellerNetCents],
  ] as const;
  const next = `/admin/payments/${order.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <Link href="/admin/payments" className="text-sm text-forest">Payments</Link>
      <h1 className="mt-3 font-serif text-4xl">{order.publicRef}</h1>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="mt-6 rounded-3xl border border-line bg-card p-5">
        <dl className="space-y-3 text-sm">
          {statement.map(([label, cents]) => (
            <div key={label} className={`flex justify-between gap-4 ${label === "Seller net" ? "border-t border-line pt-3 font-medium" : ""}`}>
              <dt>{label}</dt>
              <dd>{cents < 0 ? formatSignedMoney(cents, order.currency) : formatMoney(cents, order.currency)}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Paid</dt><dd>{order.paidAt ? formatDay(order.paidAt) : "Not paid"}</dd></div>
          <div><dt className="text-muted">Protection</dt><dd>{order.bucket === "paid" ? "Released" : "Active"}</dd></div>
          <div><dt className="text-muted">Release date</dt><dd>{order.payoutEligibleAt ? formatDay(order.payoutEligibleAt) : "Not set"}</dd></div>
          <div><dt className="text-muted">Payout</dt><dd>{order.bucket === "paid" ? "Paid out" : order.bucket === "transit" ? "On the way" : "Not started"}</dd></div>
          <div><dt className="text-muted">Dispute</dt><dd>{order.disputeStatus === "open" ? "Open" : "None"}</dd></div>
        </dl>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Four questions</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted">
          Operating cash {formatMoney(books.operatingCents, books.currency)} is Twigigi&apos;s money. Safeguarded funds {formatMoney(books.safeguardedCents, books.currency)} are seller funds. They are separate accounts.
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Ledger</h2>
        <p className="mt-1 text-sm text-muted">Append-only. These lines are added, never edited.</p>
        <ul className="mt-4 divide-y divide-line text-sm">
          {ledger.map((entry) => (
            <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline">
              <span className="font-medium">{entry.entryType}</span>
              <span className="text-muted">{ACCOUNT_LABEL[entry.account]} · {entry.memo}</span>
              <span>{formatSignedMoney(entry.amountCents, entry.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {order.bucket === "available" ? (
          <form action={startSellerPayout}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={buttonClass}>Start payout</button>
          </form>
        ) : null}
        {order.bucket === "transit" ? (
          <form action={completeSellerPayout}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={buttonClass}>Mark paid out</button>
          </form>
        ) : null}
        {order.disputeStatus === "open" ? (
          <form action={closeOrderDispute}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={ghostClass}>Close dispute</button>
          </form>
        ) : order.payoutCreatedAt ? null : (
          <form action={openOrderDispute}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="next" value={next} />
            <button className={ghostClass}>Open dispute</button>
          </form>
        )}
      </div>
    </main>
  );
}
