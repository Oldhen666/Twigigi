import Link from "next/link";
import { stopDigitalPlanRenewal } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { platformFee } from "@/lib/billing";
import { DigitalPlanPicker, type DigitalChoice } from "@/components/digital-plan-picker";
import {
  activePlanQuote,
  coveringDigitalQuotes,
  digitalChangeMessage,
  formatFeeRate,
  listingLimitLabel,
  planChange,
  subscriptionCovers,
} from "@/lib/digital-plans";
import { chargeableFileSales, legacyDigitalBilling, readDigitalSubscription, sellerProducts } from "@/lib/db";

export const metadata = { title: "Digital File plan", robots: { index: false, follow: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSeller();
  const current = readDigitalSubscription(user.id);
  const active = activePlanQuote(current);
  const covered = subscriptionCovers(current);
  const published = sellerProducts(user.id).filter((product) => product.cta === "file" && product.status === "published").length;
  const legacy = legacyDigitalBilling(user.id);
  const notice = typeof params.notice === "string" ? params.notice : "";
  const noticeText = notice === "saved"
    ? "The plan is updated. Nothing else was charged."
    : notice === "cancel"
      ? "Renewal is off. This period stays in place."
      : notice
        ? digitalChangeMessage(notice, active?.listingLimit ?? null, published)
        : "";
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sales = chargeableFileSales(user.id, since);
  const options = coveringDigitalQuotes(published);
  const now = new Date().toISOString();
  const choices: DigitalChoice[] = options.map((quote) => {
    const change = planChange({ userId: user.id, current, planId: quote.plan.id, copies: quote.copies, published, now });
    const dueCents = change.ok && change.kind === "bill" ? change.chargeCents : 0;
    const currentPlan = Boolean(active && active.plan.id === quote.plan.id && active.copies === quote.copies);
    return {
      planId: quote.plan.id,
      copies: quote.copies,
      name: quote.plan.name,
      slots: quote.listingLimit == null ? "Unlimited listings" : `${listingLimitLabel(quote.listingLimit)} listings`,
      monthlyCents: quote.monthlyCents,
      feeBps: quote.feeBps,
      monthlyLabel: `${platformFee(quote.monthlyCents, "CAD")}/month`,
      rateLabel: formatFeeRate(quote.feeBps),
      dueLabel: platformFee(dueCents, "CAD"),
      current: currentPlan,
    };
  });
  const salesLabel = sales
    ? `Last 30 days · ${platformFee(sales.cents, sales.currency === "USD" ? "USD" : "CAD")} chargeable sales from ${sales.orders === 1 ? "1 confirmed file order" : `${sales.orders} confirmed file orders`}.`
    : "No confirmed Digital File sales in the last 30 days. Enter an expected amount to estimate the platform fees.";

  return (
    <main className="mx-auto w-full max-w-[600px] px-5 py-8">
      <h1 className="font-serif text-4xl">Digital File plan</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {covered && active
          ? `${active.copies > 1 ? `${active.plan.name} × ${active.copies}` : active.plan.name} · ${active.listingLimit == null ? `${published === 1 ? "1 published listing" : `${published} published listings`}` : `${published} of ${listingLimitLabel(active.listingLimit)} published`} · ${platformFee(active.monthlyCents, "CAD")}/month · ${formatFeeRate(active.feeBps)}`
          : `No active plan · ${published === 1 ? "1 published listing" : `${published} published listings`}`}
      </p>
      {covered && current?.autoRenew ? (
        <form action={stopDigitalPlanRenewal} className="mt-2">
          <button className="text-sm text-muted">Stop renewal</button>
        </form>
      ) : null}
      {legacy.openUnpaidFileListingBills > 0 ? (
        <p className="mt-3 text-sm leading-6">
          Your existing listing bill is still due. <Link href="/dashboard/payments?tab=receipts" className="font-medium text-forest">View bill</Link>
        </p>
      ) : null}
      {noticeText ? <p className="mt-3 text-sm leading-6 text-muted">{noticeText}</p> : null}
      <p className="mt-3 text-sm leading-6 text-muted">Plans that cannot cover the published listings are left out. Extra copies are included only when that plan allows them. <Link href="/pricing" className="text-forest">View pricing</Link></p>
      <DigitalPlanPicker choices={choices} salesCents={sales && sales.currency === "CAD" ? sales.cents : null} salesLabel={sales && sales.currency !== "CAD" ? "Confirmed file sales use more than one currency, so they are not combined. Enter one CAD amount to estimate." : salesLabel} />
    </main>
  );
}
