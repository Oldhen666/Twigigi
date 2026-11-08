import Link from "next/link";
import { AdminListTools } from "@/components/admin-list-tools";
import { completeSellerPayout, startSellerPayout } from "@/lib/actions";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { allMoneyOrders } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";
import { BUCKET_LABEL, type MoneyBucket } from "@/lib/ledger";
import { buttonClass } from "@/components/ui";

const BUCKETS = ["", "available", "transit", "paid"] as const;
const SORTS = ["amount-desc", "amount-asc", "seller", "eligible"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const q = queryValue(query.q);
  const bucket = pick(queryValue(query.bucket), BUCKETS);
  const sort = pick(queryValue(query.sort), SORTS, "amount-desc");
  const all = allMoneyOrders();
  const orders = sortRows(
    all.filter((order) => {
      if (bucket && order.bucket !== bucket) return false;
      return includesText(q, [order.publicRef, order.sellerName, order.buyerName, formatMoney(order.sellerNetCents, order.currency)]);
    }),
    (order) => {
      if (sort === "seller") return order.sellerName;
      if (sort === "eligible") return order.payoutEligibleAt ?? "";
      return order.sellerNetCents;
    },
    sort === "amount-asc" || sort === "seller" || sort === "eligible" ? "asc" : "desc",
  );
  const groups: MoneyBucket[] = bucket ? [bucket as MoneyBucket] : ["available", "transit", "paid"];
  const empty = emptyListMessage(orders.length, all.length, "No Twigigi Checkout payouts.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Payouts</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Product payments go directly to the seller. Twigigi does not hold those funds and does not pay them out. A payout queue appears here only for a future Twigigi Checkout order.</p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <AdminListTools
        path="/admin/payouts"
        q={q}
        shown={orders.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "amount-desc", label: "Highest amount" },
          { value: "amount-asc", label: "Lowest amount" },
          { value: "seller", label: "Seller" },
          { value: "eligible", label: "Eligible date" },
        ]}
        filters={[
          { name: "bucket", label: "Queue", value: bucket, options: [{ value: "", label: "All queues" }, { value: "available", label: "Available" }, { value: "transit", label: "On the way" }, { value: "paid", label: "Paid out" }] },
        ]}
      />
      {empty ? (
        <p className="mt-6 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((group) => {
            const rows = orders.filter((order) => order.bucket === group);
            if (rows.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="font-serif text-2xl">{BUCKET_LABEL[group]}</h2>
                <ul className="mt-3 space-y-3">
                    {rows.map((order) => (
                      <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                        <div>
                          <Link href={`/admin/payments/${order.id}`} className="font-medium text-forest">{order.publicRef}</Link>
                          <p className="text-muted">{order.sellerName} · {order.payoutEligibleAt ? `Eligible ${formatDay(order.payoutEligibleAt)}` : "No release date"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-serif text-xl">{formatMoney(order.sellerNetCents, order.currency)}</span>
                          {group === "available" ? (
                            <form action={startSellerPayout}>
                              <input type="hidden" name="id" value={order.id} />
                              <input type="hidden" name="next" value="/admin/payouts" />
                              <button className={buttonClass}>Start payout</button>
                            </form>
                          ) : null}
                          {group === "transit" ? (
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
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
