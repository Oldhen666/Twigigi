import Link from "next/link";
import { Suspense } from "react";
import { TwigCard } from "@/components/twig-card";
import { getImpersonation, requireSeller } from "@/lib/auth";
import { listOrders, productHasActivity, sellerProducts, sellerSales, sellerStats } from "@/lib/db";
import { formatMoney, isTwigLive } from "@/lib/format";
import { sellerAttention } from "@/lib/order-flow";

async function DashboardBody() {
  const user = await requireSeller();
  const acting = Boolean(await getImpersonation());
  const stats = sellerStats(user.id);
  const sales = sellerSales(user.id);
  const products = sellerProducts(user.id);
  const orders = listOrders(user.id);
  const attention = orders.filter((order) => sellerAttention(order)).length;
  const totalOrders = orders.filter((order) => order.status !== "canceled" && order.reviewState !== "declined").length;
  const live = products.filter((product) => isTwigLive(product)).length;
  const drafts = products.filter((product) => product.status === "draft").length;
  const preview = products.slice(0, 3);

  return (
    <main className="page-frame pb-16">
      <div className="mt-6">
        <h1 className="font-serif text-4xl">Overview</h1>
        <p className="mt-2 text-sm text-muted">Manage your orders and listings.</p>
        <p className="mt-2 text-sm text-muted">
          Buyers pay you directly. Confirm a payment only after you see the money.{" "}
          <Link href="/dashboard/help" className="font-medium text-forest">Help</Link>
        </p>
        {user.billingMethod || acting ? null : (
          <p className="mt-3 text-sm">
            <Link href="/billing?next=/dashboard" className="font-medium text-forest">Add a payment method</Link>
            <span className="text-muted"> before a Twig can be published.</span>
          </p>
        )}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/orders" className="rounded-3xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Total orders</p>
          <p className="mt-2 font-serif text-3xl">{totalOrders}</p>
          <p className="mt-1 text-xs text-muted">All time</p>
        </Link>
        <div className="rounded-3xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Confirmed paid</p>
          <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "paid")}</p>
          <p className="mt-1 text-xs text-muted">Seller-reported</p>
        </div>
        <Link href="/dashboard/orders" className="rounded-3xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Awaiting payment</p>
          <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "awaiting")}</p>
          <p className="mt-1 text-xs text-muted">Unpaid order value</p>
        </Link>
        <Link href="/dashboard/views" className="rounded-3xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Listing views</p>
          <p className="mt-2 font-serif text-3xl">{stats.views}</p>
          <p className="mt-1 text-xs text-muted">All time</p>
        </Link>
      </section>

      <section className={`mt-4 rounded-3xl border px-4 py-4 ${attention > 0 ? "border-clay/30 bg-clay/10" : "border-line bg-card"}`}>
        <p className="flex items-center gap-2 font-medium">
          <span aria-hidden>🔔</span>
          {attention === 1 ? "1 order requiring attention" : `${attention} orders requiring attention`}
        </p>
        <p className="mt-1 text-sm text-muted">Review payments, pickup requests, and orders ready for fulfillment.</p>
        <Link href="/dashboard/orders" className="mt-3 flex h-11 items-center justify-center rounded-full border border-line bg-white text-sm">
          Manage orders →
        </Link>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Your Twigs</h2>
            <p className="mt-1 text-sm text-muted">{live} live · {drafts} {drafts === 1 ? "draft" : "drafts"}</p>
          </div>
          <Link href="/dashboard/twigs" className="text-sm font-medium text-forest">View all</Link>
        </div>
        {preview.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line bg-card p-6">
            <p className="font-serif text-2xl">You have something to sell.</p>
            <p className="mt-2 text-sm text-muted">Make the Twig, then share the link.</p>
            <Link href="/start" className="mt-4 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">Create a Twig</Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {preview.map((product) => (
              <TwigCard
                key={product.id}
                product={product}
                publicId={user.publicId}
                acting={acting}
                canDelete={product.status === "deactivated" || (product.status === "draft" && !productHasActivity(product.id))}
                returnTo="/dashboard"
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function moneyOf(rows: { currency: string; paidCents: number; awaitingCents: number }[], key: "paid" | "awaiting") {
  if (rows.length === 0) return formatMoney(0);
  return rows.map((row) => formatMoney(key === "paid" ? row.paidCents : row.awaitingCents, row.currency)).join(" · ");
}

export const metadata = { title: "Selling", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading…</p>}>
      <DashboardBody />
    </Suspense>
  );
}
