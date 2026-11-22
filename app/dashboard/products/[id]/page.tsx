import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { saveProduct } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { DeleteTwig } from "@/components/delete-twig";
import { ProductForm } from "@/components/product-form";
import { findUserById, getProductById, readQuoteTwigSettings, setStripeAccount } from "@/lib/db";
import { stripeConnectCountry } from "@/lib/payments";
import { quotePublishOffer } from "@/lib/quote-followup";
import { currentStripeConnect } from "@/lib/stripe";

async function Editor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const { id } = await params;
  const query = await searchParams;
  const product = getProductById(id);
  const owner = product && product.userId !== user.id && user.role === "admin" ? findUserById(product.userId) : user;
  if (!product || !owner || (product.userId !== user.id && user.role !== "admin")) notFound();
  const quoteSettings = product.cta === "quote" ? readQuoteTwigSettings(product.id) : null;
  const quoteOffer = product.cta === "quote"
    ? quotePublishOffer({ now: new Date().toISOString(), anchorDay: product.billingAnchorDay, settings: quoteSettings })
    : null;
  const stripeQuery = typeof query.stripe === "string" ? query.stripe : "";
  const stripe = product.cta === "file"
    ? await currentStripeConnect({ accountId: owner.stripeAccountId, chargesEnabled: owner.stripeChargesEnabled, query: stripeQuery })
    : { accountId: owner.stripeAccountId, chargesEnabled: owner.stripeChargesEnabled, refreshed: false };
  if (stripe.refreshed) setStripeAccount(owner.id, stripe.accountId, stripe.chargesEnabled);
  const stripeNotice: "" | "setup" | "error" = stripeQuery === "setup" ? "setup" : stripeQuery === "error" ? "error" : "";
  const stripeReason = stripeQuery === "error" && typeof query.reason === "string" ? query.reason.slice(0, 180) : "";
  const fileReturn = product.cta === "file" && (stripeQuery === "return" || stripeQuery === "refresh" || stripeNotice !== "");
  const initialStep = query.step === "2" || fileReturn ? 2 : query.step === "3" ? 3 : query.step === "4" ? 4 : 1;
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-serif text-4xl">Edit Twig</h1>
      {user.role === "admin" && product.userId !== user.id ? (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          Editing as admin · Seller: {owner.displayName}
          <Link href="/admin/twigs" className="mt-2 block font-medium text-forest">Back to Admin Twigs</Link>
        </p>
      ) : null}
      {query.saved === "1" ? <p className="mt-3 rounded-xl bg-moss px-3 py-2 text-sm text-forest">Draft saved.</p> : null}
      {query.blocked === "1" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          This draft has orders or leads, so it stays in your records.
        </p>
      ) : null}
      {query.blocked === "live" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          A live Twig cannot be deleted. Deactivate it from the dashboard first.
        </p>
      ) : null}
      <ProductForm action={saveProduct} product={product} defaultEmail={owner.email} sellerName={owner.displayName} sellerBio={owner.bio} quoteSettings={quoteSettings} quoteOffer={quoteOffer} cta={product.cta} stripeReady={stripe.chargesEnabled} stripeStarted={Boolean(stripe.accountId) && !stripe.chargesEnabled} stripeCountry={stripeConnectCountry(owner)} stripeNotice={stripeNotice} stripeReason={stripeReason} paymentDefaults={{ interac: owner.payoutInterac, venmo: owner.payoutVenmo, paypalMe: owner.payoutPaypalMe, paypalEmail: owner.payoutPaypalEmail }} initialStep={initialStep} />
      {product.status === "published" ? (
        <p className="mt-6 text-sm text-muted">
          This Twig is live, so it cannot be deleted. Deactivate it from the dashboard. The page becomes inactive. Turn it back on before the next charge date and you will not be charged again. If you do not reactivate, it is permanently deleted 30 days after it deactivates.
        </p>
      ) : (
        <div className="mt-6">
          {product.status === "deactivated" ? (
            <p className="mb-2 text-sm text-muted">
              This Twig is deactivated. You can delete it now, or reactivate it from the dashboard before it is permanently deleted.
            </p>
          ) : null}
          <DeleteTwig productId={product.id} mode={product.status === "deactivated" ? "deactivated" : "draft"} />
        </div>
      )}
    </main>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading editor…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}
