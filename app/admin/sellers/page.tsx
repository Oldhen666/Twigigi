import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSellerAccounts, platformBooks } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { BUCKET_LABEL, type MoneyBucket } from "@/lib/ledger";

const BUCKETS: MoneyBucket[] = ["protected", "available", "transit", "paid"];

export default async function Page() {
  await requireAdmin();
  const books = platformBooks();
  const sellers = listSellerAccounts();
  const accounts = [
    ["Operating cash", books.operatingCents, "Twigigi's own money. Fees land here."],
    ["Safeguarded funds", books.safeguardedCents, "Seller funds. Not Twigigi's money."],
    ["On the way", books.transitCents, "Payouts that have left the safeguarded account."],
    ["Paid out", books.paidOutCents, "Money that has reached sellers."],
  ] as const;
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Sellers</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Operating cash and seller funds are different accounts. A fee never changes a seller balance by editing it. The ledger adds a line to each account.</p>
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {accounts.map(([label, cents, detail]) => (
          <article key={label} className="rounded-2xl border border-line bg-card px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 font-serif text-3xl">{formatMoney(cents, books.currency)}</p>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </article>
        ))}
      </section>
      <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Seller</th>
              {BUCKETS.map((bucket) => (
                <th key={bucket} className="px-4 py-3 font-medium">{BUCKET_LABEL[bucket]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium">{seller.displayName}</p>
                  <p className="text-muted">{seller.email}</p>
                </td>
                {BUCKETS.map((bucket) => (
                  <td key={bucket} className="px-4 py-3">{formatMoney(seller.books.buckets[bucket].cents, seller.books.currency)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">
        Stripe has kept {formatMoney(books.stripeFeeCents, books.currency)} in processing fees. <Link href="/admin/payments" className="text-forest">Review payments</Link>
      </p>
    </main>
  );
}
