import Link from "next/link";
import { completeSellerPayout, startSellerPayout } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { allMoneyOrders } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";
import { BUCKET_LABEL, type MoneyBucket } from "@/lib/ledger";
import { buttonClass } from "@/components/ui";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const orders = allMoneyOrders();
  const groups: MoneyBucket[] = ["available", "transit", "paid"];
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Payouts</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Starting a payout moves seller funds from the safeguarded account into transit. Marking it paid out records that the money left Twigigi. Neither step rewrites an earlier ledger line.</p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 space-y-8">
        {groups.map((bucket) => {
          const rows = orders.filter((order) => order.bucket === bucket);
          return (
            <section key={bucket}>
              <h2 className="font-serif text-2xl">{BUCKET_LABEL[bucket]}</h2>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nothing {BUCKET_LABEL[bucket].toLowerCase()}.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {rows.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                      <div>
                        <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                        <p className="text-muted">{order.sellerName} · {order.payoutEligibleAt ? `Eligible ${formatDay(order.payoutEligibleAt)}` : "No release date"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-serif text-xl">{formatMoney(order.sellerNetCents, order.currency)}</span>
                        {bucket === "available" ? (
                          <form action={startSellerPayout}>
                            <input type="hidden" name="id" value={order.id} />
                            <input type="hidden" name="next" value="/admin/payouts" />
                            <button className={buttonClass}>Start payout</button>
                          </form>
                        ) : null}
                        {bucket === "transit" ? (
                          <form action={completeSellerPayout}>
                            <input type="hidden" name="id" value={order.id} />
                            <input type="hidden" name="next" value="/admin/payouts" />
                            <button className={buttonClass}>Mark paid out</button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
