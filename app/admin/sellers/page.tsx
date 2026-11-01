import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSellerSales, marketplaceGmv, platformRevenue } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export default async function Page() {
  await requireAdmin();
  const gmv = marketplaceGmv();
  const revenue = platformRevenue();
  const sellers = listSellerSales();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Sellers</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Marketplace GMV is the value of orders between buyers and sellers. Twigigi Platform Revenue is money actually collected by Twigigi. Recorded fees that were not charged are not revenue.</p>
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {gmv.length === 0 ? (
          <article className="rounded-2xl border border-line bg-card px-4 py-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted">Marketplace GMV</p>
            <p className="mt-1 font-serif text-3xl">{formatMoney(0)}</p>
          </article>
        ) : (
          gmv.map((row) => (
            <article key={row.currency} className="rounded-2xl border border-line bg-card px-4 py-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted">Marketplace GMV · {row.currency}</p>
              <p className="mt-1 font-serif text-3xl">{formatMoney(row.gmvCents, row.currency)}</p>
              <p className="mt-2 text-sm text-muted">Paid GMV {formatMoney(row.paidCents, row.currency)} · Unpaid GMV {formatMoney(row.unpaidCents, row.currency)}</p>
            </article>
          ))
        )}
        {revenue.length === 0 ? (
          <article className="rounded-2xl border border-line bg-card px-4 py-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted">Twigigi Platform Revenue</p>
            <p className="mt-1 font-serif text-3xl">{formatMoney(0)}</p>
            <p className="mt-1 text-sm text-muted">Listing and quote fees with status paid. Recorded bills are not included.</p>
          </article>
        ) : (
          revenue.map((row) => (
            <article key={row.currency} className="rounded-2xl border border-line bg-card px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted">Twigigi Platform Revenue · {row.currency}</p>
              <p className="mt-1 font-serif text-3xl">{formatMoney(row.cents, row.currency)}</p>
              <p className="mt-1 text-sm text-muted">Collected listing and quote fees only.</p>
            </article>
          ))
        )}
      </section>
      <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Seller</th>
              <th className="px-4 py-3 font-medium">Sales</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Awaiting payment</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={`${seller.id}-${seller.currency}`} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium">{seller.displayName}</p>
                  <p className="text-muted">{seller.email}</p>
                </td>
                <td className="px-4 py-3">{formatMoney(seller.salesCents, seller.currency)}</td>
                <td className="px-4 py-3">{formatMoney(seller.paidCents, seller.currency)}</td>
                <td className="px-4 py-3">{formatMoney(seller.awaitingCents, seller.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
