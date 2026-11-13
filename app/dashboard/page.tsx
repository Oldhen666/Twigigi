import Link from "next/link";
import { Suspense } from "react";
import { TwigCard } from "@/components/twig-card";
import { getImpersonation, requireSeller } from "@/lib/auth";
import { listOrders, productHasActivity, sellerProducts, sellerSales, sellerStats } from "@/lib/db";
import { formatMoney, isTwigLive, productUrl } from "@/lib/format";
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
  const share = products.find((product) => isTwigLive(product));
  const shareUrl = share ? productUrl(user.publicId, share.slug) : "";
  const fresh = products.length === 0;
  const waiting = products.length > 0 && totalOrders === 0;

  return (
    <main className="page-frame pb-16">
      <div className="mt-6">
        <h1 className="font-serif text-4xl">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {fresh ? "Create a Twig, then share the link." : "Manage your orders and Twigs."}
        </p>
      </div>

      {fresh ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-3xl">Create your first Twig</h2>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <li>1. Create the Twig.</li>
            <li>2. Add the payment method that fits that Twig. Stripe is only for digital files.</li>
            <li>3. Share your link.</li>
          </ol>
          <Link href="/start" className="mt-5 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Create a Twig</Link>
          {user.billingMethod || acting ? null : (
            <p className="mt-4 text-sm">
              <Link href="/billing?next=/dashboard" className="font-medium text-forest">Choose how you pay Twigigi fees</Link>
              <span className="text-muted"> before publishing. This does not connect Stripe for buyers.</span>
            </p>
          )}
        </section>
      ) : null}

      {waiting ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-line bg-card p-6">
          <h2 className="font-serif text-2xl">Share your Twig</h2>
          <p className="mt-2 text-sm leading-6 text-muted">You have a Twig and no orders yet. Send the link to a buyer.</p>
          {shareUrl ? <p className="mt-3 break-all text-sm font-medium">{shareUrl}</p> : <Link href="/dashboard/twigs" className="mt-4 inline-flex text-sm font-medium text-forest">View Twigs</Link>}
        </section>
      ) : null}

      {!fresh && !waiting ? (
        <>
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
            <p className="font-medium">{attention === 0 ? "Nothing needs you right now." : attention === 1 ? "1 order needs you." : `${attention} orders need you.`}</p>
            <Link href="/dashboard/orders" className="mt-3 inline-flex h-11 items-center rounded-full border border-line bg-white px-4 text-sm">View orders</Link>
          </section>
        </>
      ) : null}

      {fresh ? null : (
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Most recent Twigs</h2>
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
      )}
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
