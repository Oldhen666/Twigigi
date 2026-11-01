import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listOpenDisputes } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function Page() {
  await requireAdmin();
  const disputes = listOpenDisputes();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Disputes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">A dispute is a note on the order. For a direct payment, Twigigi does not hold the buyer&apos;s money and cannot stop a payout of funds it never received.</p>
      {disputes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No open disputes.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {disputes.map((order) => {
            const total = order.totalCents > 0 ? order.totalCents : order.amountCents;
            return (
              <li key={order.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                  <span>{formatMoney(total, order.currency)}</span>
                </div>
                <p className="mt-1 text-muted">{order.displayName} · Payment recipient: seller · Not held by Twigigi</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
