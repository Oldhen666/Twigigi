import { Suspense } from "react";
import { redirect } from "next/navigation";
import { saveProduct } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { ProductForm } from "@/components/product-form";
import { setStripeAccount } from "@/lib/db";
import { readCta } from "@/lib/format";
import { stripeConnectCountry } from "@/lib/payments";
import { quotePublishOffer } from "@/lib/quote-followup";
import { currentStripeConnect } from "@/lib/stripe";

async function NewProduct({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const params = await searchParams;
  const cta = readCta(typeof params.cta === "string" ? params.cta : undefined);
  if (!cta) redirect("/start");
  const stripe = cta === "file"
    ? await currentStripeConnect({ accountId: user.stripeAccountId, chargesEnabled: user.stripeChargesEnabled })
    : { accountId: user.stripeAccountId, chargesEnabled: user.stripeChargesEnabled, refreshed: false };
  if (stripe.refreshed) setStripeAccount(user.id, stripe.accountId, stripe.chargesEnabled);
  const title = cta === "buy" ? "New Product" : cta === "file" ? "New digital file" : cta === "quote" ? "Create a quote listing" : "New Contact";
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-serif text-4xl">{title}</h1>
      <ProductForm action={saveProduct} defaultEmail={user.email} sellerName={user.displayName} sellerBio={user.bio} cta={cta} quoteOffer={cta === "quote" ? quotePublishOffer({ now: new Date().toISOString(), settings: null }) : null} stripeReady={stripe.chargesEnabled} stripeStarted={Boolean(stripe.accountId) && !stripe.chargesEnabled} stripeCountry={stripeConnectCountry(user)} paymentDefaults={{ interac: user.payoutInterac, venmo: user.payoutVenmo, paypalMe: user.payoutPaypalMe, paypalEmail: user.payoutPaypalEmail }} />
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading editor…</p>}>
      <NewProduct searchParams={searchParams} />
    </Suspense>
  );
}
