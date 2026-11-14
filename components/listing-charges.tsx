import { platformFee } from "@/lib/billing";
import type { ListingChargeBatch, ListingChargeCurrency, ListingChargeRow } from "@/lib/listing-charges";

function listingLabel(row: ListingChargeRow) {
  return row.listingWaived ? "Waived" : platformFee(row.listingCents, row.currency);
}

function quoteLabel(row: ListingChargeRow) {
  const amount = platformFee(row.quoteCents, row.currency);
  if (row.quoteCount < 1) return amount;
  const requests = row.quoteCount === 1 ? "request" : "requests";
  return `${amount} · ${row.quoteCount} ${requests}`;
}

function dateLabel(value: string) {
  return value || "Not scheduled";
}

function ChargeTable({ batch }: { batch: ListingChargeBatch }) {
  return (
    <>
      <div className="hidden sm:block">
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">Listing fee plus quote fees equals total due for this billing date.</caption>
          <thead className="text-[13px] text-muted">
            <tr>
              <th className="py-2 pr-3 font-normal">Twig</th>
              <th className="py-2 pr-3 font-normal">Listing fee</th>
              <th className="py-2 pr-3 font-normal">Quote fees</th>
              <th className="py-2 pr-3 font-normal">Total due</th>
              <th className="py-2 pr-3 font-normal">Billing date</th>
              <th className="py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => (
              <tr key={`${row.productId}-${batch.key}`} className="border-t border-line align-top">
                <td className="break-words py-2.5 pr-3 font-medium">{row.title}</td>
                <td className="py-2.5 pr-3 font-sans font-semibold tabular-nums">{listingLabel(row)}</td>
                <td className="py-2.5 pr-3 font-sans font-semibold tabular-nums">{quoteLabel(row)}</td>
                <td className="py-2.5 pr-3 font-sans font-semibold tabular-nums">{platformFee(row.totalCents, row.currency)}</td>
                <td className="py-2.5 pr-3 font-sans tabular-nums">{dateLabel(row.billingDate)}</td>
                <td className="py-2.5">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-line sm:hidden">
        {batch.rows.map((row) => (
          <details key={`${row.productId}-${batch.key}`} className="py-2.5">
            <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 break-words text-[15px] font-medium">{row.title}</span>
              <span className="font-sans text-[15px] font-semibold tabular-nums">{platformFee(row.totalCents, row.currency)}</span>
              <span className="text-[13px] text-muted">{dateLabel(row.billingDate)}</span>
              <span className="text-right text-[13px]">{row.status}</span>
            </summary>
            <div className="mt-2 grid gap-1 text-[13px] leading-5 text-muted">
              <p className="flex justify-between gap-3"><span>Listing fee</span><span className="font-sans font-semibold tabular-nums text-ink">{listingLabel(row)}</span></p>
              <p className="flex justify-between gap-3"><span>Quote fees</span><span className="font-sans font-semibold tabular-nums text-ink">{quoteLabel(row)}</span></p>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

function scopeCopy(currency: ListingChargeCurrency) {
  const batch = currency.next;
  if (!batch) return "";
  if (batch.key === "unscheduled") {
    return `Not scheduled. A fee that has not been created stays at 0. This table is not your ${currency.currency} balance.`;
  }
  return `Next billing date · ${batch.billingDate} · ${currency.currency}. This table is that batch only, not your ${currency.currency} balance.`;
}

export function ListingCharges({ currencies }: { currencies: ListingChargeCurrency[] }) {
  if (currencies.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-serif text-xl">Listing charges</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">Listing fee + quote fees = total due. Paid charges are not added again.</p>
      <div className="mt-3 space-y-4">
        {currencies.map((currency) => currency.next ? (
          <section key={currency.currency} className="min-w-0">
            <p className="text-[13px] leading-5 text-muted">{scopeCopy(currency)}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span>This batch <span className="font-sans font-semibold tabular-nums">{platformFee(currency.next.totalCents, currency.currency)}</span></span>
              <a href={`/dashboard/payments/balance?currency=${currency.currency}`} className="underline decoration-1 underline-offset-2">
                {currency.currency} balance <span className="font-sans font-semibold tabular-nums">{platformFee(currency.balanceCents, currency.currency)}</span>
              </a>
            </p>
            <div className="mt-2">
              <ChargeTable batch={currency.next} />
            </div>
            {currency.others.length > 0 ? (
              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-[14px] font-medium [&::-webkit-details-marker]:hidden">Other billing dates</summary>
                <div className="mt-3 space-y-4">
                  {currency.others.map((batch) => (
                    <section key={batch.key}>
                      <p className="text-[13px] text-muted">
                        {batch.key === "unscheduled" ? "Not scheduled" : batch.billingDate}
                        {" · "}
                        This batch <span className="font-sans font-semibold tabular-nums text-ink">{platformFee(batch.totalCents, currency.currency)}</span>
                      </p>
                      <div className="mt-1">
                        <ChargeTable batch={batch} />
                      </div>
                    </section>
                  ))}
                </div>
              </details>
            ) : null}
            <p className="mt-2 text-[13px] leading-5 text-muted">
              Paid charges stay in{" "}
              <a href={`/dashboard/payments/balance?currency=${currency.currency}`} className="underline decoration-1 underline-offset-2">All</a>
              {" "}and{" "}
              <a href={`/dashboard/payments/balance?currency=${currency.currency}&status=paid`} className="underline decoration-1 underline-offset-2">Paid</a>.
            </p>
          </section>
        ) : null)}
      </div>
    </div>
  );
}
