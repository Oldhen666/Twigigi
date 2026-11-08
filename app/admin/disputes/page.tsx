import Link from "next/link";
import { AdminListTools } from "@/components/admin-list-tools";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { listOpenDisputes } from "@/lib/db";
import { formatMoney } from "@/lib/format";

const WAYS = ["", "pickup", "delivery", "shipping", "digital"] as const;
const SORTS = ["newest", "amount-desc", "amount-asc"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const q = queryValue(query.q);
  const way = pick(queryValue(query.way), WAYS);
  const sort = pick(queryValue(query.sort), SORTS, "newest");
  const all = listOpenDisputes();
  const disputes = sortRows(
    all.filter((order) => {
      if (way && order.fulfillment !== way) return false;
      const total = order.totalCents > 0 ? order.totalCents : order.amountCents;
      return includesText(q, [order.publicRef, order.displayName, order.buyerName, order.productTitle, formatMoney(total, order.currency)]);
    }),
    (order) => (sort.startsWith("amount") ? (order.totalCents > 0 ? order.totalCents : order.amountCents) : order.createdAt),
    sort === "amount-asc" ? "asc" : "desc",
  );
  const empty = emptyListMessage(disputes.length, all.length, "No open disputes.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Disputes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">A dispute is a note on the order. For a direct payment, Twigigi does not hold the buyer&apos;s money and cannot stop a payout of funds it never received.</p>
      <AdminListTools
        path="/admin/disputes"
        q={q}
        shown={disputes.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "newest", label: "Newest" },
          { value: "amount-desc", label: "Highest total" },
          { value: "amount-asc", label: "Lowest total" },
        ]}
        filters={[
          { name: "way", label: "Fulfillment", value: way, options: [{ value: "", label: "Any fulfillment" }, { value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery" }, { value: "shipping", label: "Shipping" }, { value: "digital", label: "Digital file" }] },
        ]}
      />
      {empty ? (
        <p className="mt-6 text-sm text-muted">{empty}</p>
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
