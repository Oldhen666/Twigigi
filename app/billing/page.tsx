import Link from "next/link";
import { Suspense } from "react";
import { BillingPreferenceForm } from "@/components/billing-preference-form";
import { requireUser } from "@/lib/auth";
import { platformFee } from "@/lib/billing";
import { getProductById, readQuoteTwigSettings } from "@/lib/db";
import { safeNext } from "@/lib/format";
import { paypalConfigured } from "@/lib/paypal";
import { QUOTE_LISTING_CENTS, quoteListingCharge } from "@/lib/quote-followup";

function listingFeeLine(next: string, userId: string) {
  let url: URL;
  try {
    url = new URL(next, "http://twigigi.local");
  } catch {
    return "";
  }
  const match = url.pathname.match(/^\/dashboard\/products\/([^/]+)$/);
  const productId = match ? decodeURIComponent(match[1]) : "";
  if (!productId || productId === "new") return "";
  const product = getProductById(productId);
  if (!product || product.userId !== userId || product.cta !== "quote" || product.feeExempt) return "";
  const settings = readQuoteTwigSettings(product.id);
  const charge = settings && settings.listingRateCents > 0
    ? quoteListingCharge(settings.listingRateCents, settings.listingCurrency)
    : quoteListingCharge(QUOTE_LISTING_CENTS, "CAD");
  if (charge.cents < 1) return "";
  return `Listing fee for this Twig: ${platformFee(charge.cents, charge.currency)} per month.`;
}

async function BillingScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : "/dashboard");
  const user = await requireUser();
  const feeLine = listingFeeLine(next, user.id);

  return (
    <main className="seller-theme min-h-dvh">
      <div className="mx-auto w-full max-w-[540px] px-5 py-8">
        <Link href={next} className="text-sm text-muted">← Back</Link>
        <h1 className="mt-5 font-serif text-4xl leading-tight">How would you like to pay Twigigi?</h1>
        <p className="mt-3 text-sm leading-6 text-muted">This preference applies to your Twigigi fees.</p>
        {feeLine ? <p className="mt-3 text-sm leading-6">{feeLine}</p> : null}
        <BillingPreferenceForm next={next} saved={user.billingMethod} paypalAvailable={paypalConfigured()} />
        <div className="mt-8 flex flex-col items-start gap-2 text-sm">
          <Link href="/dashboard/payments?tab=receipts" className="text-muted">Manage billing</Link>
          <Link href="/pricing" className="text-muted">View pricing</Link>
        </div>
      </div>
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <BillingScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Twigigi fees", robots: { index: false, follow: false } };
