import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { DeactivateTwig } from "@/components/deactivate-twig";
import { DeleteTwig } from "@/components/delete-twig";
import { CopyLink } from "@/components/share-bar";
import { sellerProducts, sellerStats } from "@/lib/db";
import { ctaCopy, addDays, DEACTIVATION_GRACE_DAYS, formatBillingDate, formatMoney, isTwigLive, nextBillingDate, productUrl } from "@/lib/format";

async function DashboardBody() {
  const user = await requireSeller();
  const stats = sellerStats(user.id);
  const products = sellerProducts(user.id);
  const summary = [
    ["Views", String(stats.views), "/dashboard/views"],
    ["Orders", String(stats.orders), "/dashboard/orders"],
    ["Quotes", String(stats.quotes), "/dashboard/quotes"],
  ];
  const billingEndsLabel = formatBillingDate(nextBillingDate());

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <div className="mt-6">
        <h1 className="font-serif text-4xl">Your Twigs</h1>
        <p className="mt-2 text-sm text-muted">Hi, {user.displayName}</p>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-card">
        <div className="grid grid-cols-3 divide-x divide-line">
          {summary.map(([label, value, href]) => (
            <Link key={label} href={href} className="px-4 py-3 hover:bg-paper-deep">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-serif text-2xl">{value}</p>
            </Link>
          ))}
        </div>
      </section>

      {products.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-card p-6">
          <p className="font-serif text-2xl">You have something to sell.</p>
          <p className="mt-2 text-sm text-muted">Make the Twig, then share the link.</p>
          <Link href="/start" className="mt-4 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
            Create a Twig
          </Link>
        </div>
      ) : (
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Twigs</h2>
            <Link href="/start" className="text-sm text-forest">New Twig</Link>
          </div>
          {products.map((product) => {
            const live = isTwigLive(product);
            const ending = live && Boolean(product.deactivatesAt);
            const url = productUrl(user.username, product.slug);
            const badge = product.status === "deactivated" ? "Deactivated" : ending ? "Deactivating" : live ? "Live" : "Draft";
            const endsLabel = product.deactivatesAt ? formatBillingDate(product.deactivatesAt) : billingEndsLabel;
            const deactivatedLabel = product.deactivatedAt ? formatBillingDate(product.deactivatedAt, true) : "";
            const deleteLabel = formatBillingDate(
              addDays(product.status === "deactivated" && product.deactivatedAt ? product.deactivatedAt : product.deactivatesAt || nextBillingDate(), DEACTIVATION_GRACE_DAYS),
              true,
            );
            return (
              <article key={product.id} className="flex gap-4 rounded-3xl border border-line bg-card p-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-paper-deep">
                  {product.images[0] ? (
                    <Image src={product.images[0]} alt="" fill className="object-cover" sizes="96px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-2xl leading-tight">{product.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${live && !ending ? "bg-moss text-forest" : ending ? "bg-paper-deep text-clay" : "bg-paper-deep text-muted"}`}>
                      {badge}
                    </span>
                  </div>
                  <p className="mt-1 font-serif text-xl text-forest">
                    {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {ctaCopy(product.cta).label} · {product.viewCount} {product.viewCount === 1 ? "view" : "views"}
                  </p>
                  {ending && product.deactivatesAt ? (
                    <p className="mt-2 text-sm text-muted">Paid through {endsLabel}. It deactivates that day. If you do not reactivate, it is permanently deleted on {deleteLabel}.</p>
                  ) : null}
                  {product.status === "deactivated" ? (
                    <p className="mt-2 text-sm text-muted">Deactivated{deactivatedLabel ? ` on ${deactivatedLabel}` : ""}. The link is off. Reactivate before {deleteLabel} or this Twig is permanently deleted.</p>
                  ) : null}
                  {product.status === "draft" ? (
                    <p className="mt-2 text-sm text-muted">Platform billing starts when you publish.</p>
                  ) : null}
                  {product.status === "published" && !ending ? (
                    <p className="mt-2 text-sm text-muted">Paid through {billingEndsLabel}.</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <Link href={`/dashboard/products/${product.id}`} className="font-medium text-forest">Edit</Link>
                    {live ? <Link href={`/${user.username}/${product.slug}`} className="font-medium text-forest">Open</Link> : null}
                    {live ? <CopyLink url={url} /> : null}
                    {product.status === "published" ? (
                      <DeactivateTwig productId={product.id} mode={ending ? "ending" : "live"} endsLabel={endsLabel} deleteLabel={deleteLabel} />
                    ) : null}
                    {product.status === "deactivated" ? (
                      <DeactivateTwig productId={product.id} mode="deactivated" endsLabel={deactivatedLabel} deleteLabel={deleteLabel} />
                    ) : null}
                    {product.status === "draft" ? <DeleteTwig productId={product.id} /> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

    </main>
  );
}

export const metadata = { title: "Your Twigs", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading your Twigs…</p>}>
      <DashboardBody />
    </Suspense>
  );
}
