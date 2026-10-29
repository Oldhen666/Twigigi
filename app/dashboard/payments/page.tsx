import { connection } from "next/server";
import { savePayoutDetails } from "@/lib/actions";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { requireSeller } from "@/lib/auth";
import { listSellerBills } from "@/lib/db";
import { billingYear, formatDate, formatMoney } from "@/lib/format";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const user = await requireSeller();
  const bills = listSellerBills(user.id);
  const years = [...new Set(bills.map((bill) => billingYear(bill.createdAt)).filter(Boolean))];
  const currentYear = billingYear(new Date().toISOString());
  if (currentYear && !years.includes(currentYear)) years.unshift(currentYear);
  years.sort((left, right) => Number(right) - Number(left));
  const initial = params.tab === "receipts" ? "receipts" : "receiving";

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Payment settings</h1>
      <p className="mt-2 text-sm text-muted">Where buyers pay you, and the receipts for Twigigi fees.</p>
      <PaymentSettingsTabs
        initial={initial}
        receiving={
          <section className="rounded-3xl border border-line bg-card p-5">
            <p className="text-sm text-muted">Where buyers can pay you. These are not the card Twigigi charges.</p>
            <form action={savePayoutDetails} className="mt-4 grid gap-4" noValidate>
              <label>
                <span className={labelClass}>Interac e-Transfer email</span>
                <input name="interac" defaultValue={user.payoutInterac} className={inputClass} autoComplete="email" />
              </label>
              <label>
                <span className={labelClass}>Venmo username</span>
                <input name="venmo" defaultValue={user.payoutVenmo} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>Zelle phone or email</span>
                <input name="zelle" defaultValue={user.payoutZelle} className={inputClass} />
              </label>
              <button className={`${buttonClass} w-fit`}>Save receiving details</button>
            </form>
          </section>
        }
        receipts={
          <>
            <BillingMethodForm saved={user.billingMethod} />
            <section className="mt-6 rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">Receipts</h2>
                <div className="flex flex-wrap gap-2">
                  {years.map((year) => (
                    <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm`}>
                      Download {year} PDF
                    </a>
                  ))}
                </div>
              </div>
              {bills.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No receipt yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {bills.map((bill) => (
                    <li key={`${bill.createdAt}-${bill.title}-${bill.kind}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{bill.title}</p>
                        <p className="text-muted">
                          {bill.kind === "quote" ? "Quote request" : "Listing"} · {bill.status} · {formatDate(bill.createdAt)}
                        </p>
                      </div>
                      <p className="font-serif text-lg">{formatMoney(bill.amountCents, bill.currency)} {bill.currency}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        }
      />
    </main>
  );
}

export const metadata = { title: "Payment settings", robots: { index: false, follow: false } };
