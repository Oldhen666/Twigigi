import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { setLeadStatus } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { DeactivateTwig } from "@/components/deactivate-twig";
import { DeleteTwig } from "@/components/delete-twig";
import { CopyLink } from "@/components/share-bar";
import { listMessages, listOrders, listQuotes, sellerBooks, sellerProducts, sellerStats, sellerViewSources } from "@/lib/db";
import { BUCKET_LABEL } from "@/lib/ledger";
import { ctaCopy, addDays, DEACTIVATION_GRACE_DAYS, formatBillingDate, formatDate, formatMoney, isPrivateUsername, isTwigLive, nextBillingDate, productUrl, srcLabel } from "@/lib/format";

async function DashboardBody() {
  const user = await requireSeller();
  const stats = sellerStats(user.id);
  const products = sellerProducts(user.id);
  const viewSources = sellerViewSources(user.id);
  const orders = listOrders(user.id);
  const quotes = listQuotes(user.id);
  const messages = listMessages(user.id);
  const books = sellerBooks(user.id);
  const summary = [
    ["Views", String(stats.views)],
    ["Orders", String(stats.orders)],
    ["Revenue", formatMoney(stats.revenueCents)],
    ["Quotes", String(stats.quotes)],
    ["Messages", String(stats.messages)],
  ];
  const hasActivity = orders.length + quotes.length + messages.length > 0;
  const activityCount = [orders, quotes, messages].filter((items) => items.length > 0).length;
  const billingEndsLabel = formatBillingDate(nextBillingDate());

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">Your Twigs</h1>
          <p className="mt-1 text-sm text-muted">{isPrivateUsername(user.username) ? "Your public link is created when you publish." : `twigigi.com/${user.username}`}</p>
        </div>
        <Link href="/start" className="inline-flex h-10 shrink-0 items-center rounded-full bg-forest px-4 text-sm text-card">
          New Twig +
        </Link>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-card">
        <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3">
          {summary.map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1 font-serif text-2xl">{value}</dd>
            </div>
          ))}
          <div className="px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-muted">{BUCKET_LABEL.available}</dt>
            <dd className="mt-1 font-serif text-2xl">{formatMoney(books.buckets.available.cents, books.currency)}</dd>
          </div>
        </dl>
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
          <h2 className="font-serif text-2xl">Twigs</h2>
          {products.map((product) => {
            const live = isTwigLive(product);
            const ending = live && Boolean(product.deactivatesAt);
            const url = productUrl(user.username, product.slug);
            const badge = product.status === "deactivated" ? "Deactivated" : ending ? "Deactivating" : live ? "Live" : "Draft";
            const endsLabel = product.deactivatesAt ? formatBillingDate(product.deactivatesAt) : billingEndsLabel;
            const deactivatedLabel = product.deactivatedAt ? formatBillingDate(product.deactivatedAt, true) : "";
            const sources = viewSources.get(product.id) ?? [];
            const topSource = sources[0]?.count ?? 1;
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
                  <div className="mt-4">
                    <p className="text-sm font-medium">Where visits came from</p>
                    {sources.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No visits yet.</p>
                    ) : (
                      <ul className="mt-2 max-w-xs space-y-2">
                        {sources.map((source) => (
                          <li key={source.src}>
                            <div className="flex justify-between text-sm">
                              <span>{srcLabel(source.src)}</span>
                              <span className="text-muted">{source.count}</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-paper-deep">
                              <div className="h-2 rounded-full bg-forest" style={{ width: `${Math.max(8, (source.count / topSource) * 100)}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {hasActivity ? (
        <section className={`mt-10 grid gap-8 ${activityCount > 2 ? "lg:grid-cols-3" : activityCount > 1 ? "lg:grid-cols-2" : ""}`}>
          {orders.length > 0 ? (
            <LeadColumn title="Orders">
              {orders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-line bg-card p-3 text-sm">
                  <p className="font-medium">{order.publicRef ? order.publicRef : order.buyerName}</p>
                  <p className="text-muted">{order.buyerName}</p>
                  <p className="text-muted">{order.productTitle}{order.variantLabel ? ` · ${order.variantLabel}` : ""} · {order.quantity} · {order.fulfillment}</p>
                  <p className="mt-1">{formatMoney(order.amountCents, order.currency)}</p>
                  <p className="text-muted">{order.email} · {order.phone}</p>
                  {order.address ? <p className="text-muted">{order.address}</p> : null}
                  <p className="text-muted">{srcLabel(order.src)} · {formatDate(order.createdAt)}</p>
                  <StatusForm kind="order" id={order.id} status={order.status} options={["unpaid", "paid", "fulfilled", "canceled"]} />
                </article>
              ))}
            </LeadColumn>
          ) : null}
          {quotes.length > 0 ? (
            <LeadColumn title="Quotes">
              {quotes.map((quote) => (
                <article key={quote.id} className="rounded-2xl border border-line bg-card p-3 text-sm">
                  <p className="font-medium">{quote.name}</p>
                  <p className="text-muted">{quote.productTitle} · qty {quote.quantity}</p>
                  {quote.projectDetails ? <p className="mt-1">{quote.projectDetails}</p> : null}
                  {quote.message ? <p className="text-muted">{quote.message}</p> : null}
                  {quote.documents.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {quote.documents.map((file) => (
                        <li key={file.path}>
                          <a href={file.path} target="_blank" rel="noreferrer" className="text-forest">
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-muted">{quote.email} · {quote.phone}</p>
                  <p className="text-muted">{srcLabel(quote.src)} · {formatDate(quote.createdAt)}</p>
                  <StatusForm kind="quote" id={quote.id} status={quote.status} options={["new", "contacted", "closed"]} />
                </article>
              ))}
            </LeadColumn>
          ) : null}
          {messages.length > 0 ? (
            <LeadColumn title="Messages">
              {messages.map((message) => (
                <article key={message.id} className="rounded-2xl border border-line bg-card p-3 text-sm">
                  <p className="font-medium">{message.name}</p>
                  <p className="text-muted">{message.productTitle}</p>
                  <p className="mt-1">{message.message}</p>
                  <p className="text-muted">{message.email} · {message.phone}</p>
                  <p className="text-muted">{srcLabel(message.src)} · {formatDate(message.createdAt)}</p>
                  <StatusForm kind="message" id={message.id} status={message.status} options={["new", "read", "closed"]} />
                </article>
              ))}
            </LeadColumn>
          ) : null}
        </section>
      ) : (
        <p className="mt-10 text-sm text-muted">Orders, quotes, and messages will show up here.</p>
      )}
    </main>
  );
}

function LeadColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function StatusForm({
  kind,
  id,
  status,
  options,
}: {
  kind: string;
  id: string;
  status: string;
  options: string[];
}) {
  return (
    <form action={setLeadStatus} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button className="text-sm text-forest">Save</button>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading your Twigs…</p>}>
      <DashboardBody />
    </Suspense>
  );
}
