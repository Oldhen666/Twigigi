import { platformFee } from "@/lib/billing";
import type { ListingChargeCurrency, ListingChargeRow } from "@/lib/listing-charges";

function feeLabel(row: ListingChargeRow) {
  if (row.nextFeeWaived) return "Waived";
  if (row.nextFeeCents < 1) return "Not scheduled";
  return platformFee(row.nextFeeCents, row.currency);
}

function quoteLabel(row: ListingChargeRow) {
  const amount = platformFee(row.quoteCents, row.currency);
  const requests = row.quoteCount === 1 ? "request" : "requests";
  return `${amount} · ${row.quoteCount} ${requests}`;
}

export function ListingCharges({ currencies }: { currencies: ListingChargeCurrency[] }) {
  const shown = currencies.filter((currency) => currency.rows.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="mt-4 space-y-6">
      {shown.map((currency) => (
        <section key={currency.currency} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-medium tracking-[0.12em] text-muted uppercase">{currency.currency}</h4>
            <a href={`/dashboard/payments/balance?currency=${currency.currency}`} className="text-[13px] underline decoration-1 underline-offset-2">
              Balance <span className="font-sans font-semibold tabular-nums">{platformFee(currency.balanceCents, currency.currency)}</span>
            </a>
          </div>
          <ul className="mt-2 space-y-2">
            {currency.rows.map((row) => (
              <li key={row.productId} className="min-w-0 rounded-xl border border-line bg-paper px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-[15px] font-medium">{row.title}</p>
                  <p className="shrink-0 text-[13px] text-muted">{row.status}</p>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <dt className="text-[13px] text-muted">Next fee</dt>
                    <dd className="font-sans text-[15px] font-semibold tabular-nums">{feeLabel(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">Expiry</dt>
                    <dd className="font-sans text-[15px] tabular-nums">{row.expiry || "—"}</dd>
                  </div>
                  {row.cta === "quote" ? (
                    <div>
                      <dt className="text-[13px] text-muted">Quotes this period</dt>
                      <dd className="font-sans text-[15px] font-semibold tabular-nums">{quoteLabel(row)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
