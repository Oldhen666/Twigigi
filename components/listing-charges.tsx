import { platformFee } from "@/lib/billing";
import type { ListingChargeCurrency, ListingChargeRow } from "@/lib/listing-charges";

function feeLabel(row: ListingChargeRow) {
  if (row.nextFeeWaived) return "Waived";
  if (row.nextFeeCents < 1) return "Not scheduled";
  return platformFee(row.nextFeeCents, row.currency);
}

function quoteLabel(row: ListingChargeRow) {
  if (row.cta !== "quote") return "—";
  const amount = platformFee(row.quoteCents, row.currency);
  const requests = row.quoteCount === 1 ? "request" : "requests";
  return `${amount} · ${row.quoteCount} ${requests}`;
}

export function ListingCharges({ currencies }: { currencies: ListingChargeCurrency[] }) {
  const shown = currencies.filter((currency) => currency.rows.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-serif text-xl">Listing charges</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">Each Twig shows its next listing fee and when the current period ends. A quote Twig also shows requests received so far. Paid charges are not included.</p>
      <div className="mt-3 space-y-5">
        {shown.map((currency) => (
          <section key={currency.currency} className="min-w-0">
            <p className="text-[13px]">
              <a href={`/dashboard/payments/balance?currency=${currency.currency}`} className="underline decoration-1 underline-offset-2">
                {currency.currency} balance <span className="font-sans font-semibold tabular-nums">{platformFee(currency.balanceCents, currency.currency)}</span>
              </a>
            </p>
            <div className="mt-2 hidden sm:block">
              <table className="w-full text-left text-[14px]">
                <caption className="sr-only">Next listing fee, expiry, and quote fees received so far for each Twig.</caption>
                <thead className="text-[13px] text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-normal">Twig</th>
                    <th className="py-2 pr-3 font-normal">Next fee</th>
                    <th className="py-2 pr-3 font-normal">Expiry</th>
                    <th className="py-2 font-normal">Quotes this period</th>
                  </tr>
                </thead>
                <tbody>
                  {currency.rows.map((row) => (
                    <tr key={row.productId} className="border-t border-line align-top">
                      <td className="break-words py-2.5 pr-3 font-medium">{row.title}</td>
                      <td className="py-2.5 pr-3 font-sans font-semibold tabular-nums">{feeLabel(row)}</td>
                      <td className="py-2.5 pr-3 font-sans tabular-nums">{row.expiry || "—"}</td>
                      <td className="py-2.5 font-sans font-semibold tabular-nums">{quoteLabel(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-line sm:hidden">
              {currency.rows.map((row) => (
                <div key={row.productId} className="py-2.5">
                  <p className="break-words text-[15px] font-medium">{row.title}</p>
                  <div className="mt-1 grid gap-1 text-[13px] leading-5">
                    <p className="flex justify-between gap-3"><span className="text-muted">Next fee</span><span className="font-sans font-semibold tabular-nums">{feeLabel(row)}</span></p>
                    <p className="flex justify-between gap-3"><span className="text-muted">Expiry</span><span className="font-sans tabular-nums">{row.expiry || "—"}</span></p>
                    {row.cta === "quote" ? (
                      <p className="flex justify-between gap-3"><span className="text-muted">Quotes this period</span><span className="font-sans font-semibold tabular-nums">{quoteLabel(row)}</span></p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
