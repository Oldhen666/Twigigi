import { saveBillingMethod, savePayoutDetails } from "@/lib/actions";
import { billingMethodLabel } from "@/lib/billing";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { requireSeller } from "@/lib/auth";
import { listSellerBills } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSeller();
  const bills = listSellerBills(user.id);
  const cardOnFile = user.billingMethod === "card" || user.billingMethod === "stripe";
  const paypalOnFile = user.billingMethod === "paypal";
  const method = billingMethodLabel(user.billingMethod);
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
            <section className="rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Card on file</h2>
              {cardOnFile ? (
                <>
                  <p className="mt-3 font-medium">{method}</p>
                  <p className="mt-1 font-serif text-2xl tracking-[0.18em]">•••• •••• •••• ••••</p>
                  <p className="mt-2 text-sm text-muted">This spot is reserved for your card. Twigigi does not keep the full number. Stripe charges it when a listing fee is due.</p>
                </>
              ) : paypalOnFile ? (
                <p className="mt-3">PayPal is the method on file. No card number is saved.</p>
              ) : (
                <p className="mt-3 text-muted">No payment method saved yet.</p>
              )}
              <form action={saveBillingMethod} className="mt-4 grid gap-3">
                <input type="hidden" name="next" value="/dashboard/payments?tab=receipts" />
                <label className="flex cursor-pointer gap-3">
                  <input type="radio" name="method" value="card" defaultChecked={!paypalOnFile} className="mt-1 accent-forest" />
                  <span>
                    <span className="block">Credit or debit card</span>
                    <span className="mt-0.5 block text-sm text-muted">Visa · Mastercard · Amex, charged through Stripe</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="radio" name="method" value="paypal" defaultChecked={paypalOnFile} className="accent-forest" />
                  <span>PayPal</span>
                </label>
                <button className={`${buttonClass} w-fit`}>{user.billingMethod ? "Save payment method" : "Add a payment method"}</button>
              </form>
            </section>
            <section className="mt-6 rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Receipts</h2>
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
