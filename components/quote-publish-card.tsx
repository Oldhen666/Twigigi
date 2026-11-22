import { platformFee } from "@/lib/billing";
import { quoteFollowupRules, quoteListingRateLine, quoteRenewalLine } from "@/lib/quote-followup";

export function QuotePublishCard({
  title,
  cents,
  currency,
  anchor,
}: {
  title: string;
  cents: number;
  currency: string;
  anchor: 15 | 28;
}) {
  const amount = platformFee(cents, currency);
  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <p className="text-lg">{title}</p>
      <h2 className="mt-4 text-base font-medium">Listing subscription</h2>
      <p className="mt-2 text-sm leading-6">{quoteListingRateLine(cents, currency)}</p>
      <p className="mt-3 text-sm leading-6">Due today: {amount}</p>
      <p className="mt-1 text-sm leading-6">{quoteRenewalLine(cents, currency, anchor)}</p>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-forest">How Get a Quote fees work</summary>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          {quoteFollowupRules().map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
