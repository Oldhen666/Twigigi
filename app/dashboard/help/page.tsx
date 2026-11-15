import Link from "next/link";

export const metadata = { title: "How you get paid", robots: { index: false, follow: false } };

const destinations = [
  ["Interac e-Transfer", "The e-Transfer email saved on the Twig. Canada Buy now listings."],
  ["PayPal", "Buy now: the PayPal.Me link saved on the Twig. Digital file: the PayPal email saved on the Twig, paid through PayPal checkout."],
  ["Venmo", "The Venmo username saved on the Twig. United States Buy now listings."],
  ["Stripe", "The connected Stripe account. Stripe then pays out to the bank account or debit card saved in Stripe. Digital file card payments only."],
  ["Cash", "You, in person, at pickup. Canada listings use Cash on pickup. United States listings use Cash. Delivery and shipping do not offer cash."],
];

const totals = [
  ["Total orders", "A count of orders that are not canceled. All time."],
  ["Confirmed paid", "Order value marked paid, shown separately for each currency. This includes payments you confirmed and digital-file payments that Stripe or PayPal confirmed. Those two kinds of payments are not split into separate totals. The card reads Seller-reported."],
  ["Awaiting payment", "Order value that is not marked paid, shown separately for each currency. Canceled orders are left out. An order marked Verifying Payment stays here until you confirm the money."],
];

export default function Page() {
  return (
    <main className="page-frame pb-16">
      <div className="max-w-[760px]">
      <h1 id="bank" className="mt-6 scroll-mt-24 font-serif text-4xl">How you get paid</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Buyers pay you directly using the payment methods enabled on your Twig.</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Where payments go</h2>
        <InfoTable headers={["Payment method", "Where payments go"]} rows={destinations} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Confirming payment</h2>
        <dl className="mt-3 space-y-3 text-sm leading-6">
          <div>
            <dt className="font-medium">e-Transfer, PayPal.Me, and Venmo</dt>
            <dd className="text-muted">These stay unpaid until you confirm them, after the money is in that account. If the buyer chooses I&apos;ve Sent Payment, the order shows Verifying Payment. That does not mean you have received the money.</dd>
          </div>
          <div>
            <dt className="font-medium">Stripe card payments</dt>
            <dd className="text-muted">When Stripe confirms a digital-file card payment, Twigigi marks the order paid and emails the file. You do not confirm that payment.</dd>
          </div>
          <div>
            <dt className="font-medium">PayPal on a digital file</dt>
            <dd className="text-muted">When PayPal confirms that checkout, Twigigi marks the order paid and emails the file. You do not confirm that payment.</dd>
          </div>
          <div>
            <dt className="font-medium">Cash</dt>
            <dd className="text-muted">Cash stays unpaid until you confirm it at pickup. A buyer cannot mark cash as sent.</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Understanding your totals</h2>
        <p className="mt-2 text-sm leading-6 text-muted">These are the labels on Overview.</p>
        <InfoTable headers={["Overview", "What it counts"]} rows={totals} />
      </section>

      <aside className="mt-8 rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-6">
        <p>Twigigi does not receive these payments, hold them, or deposit them for you.</p>
        <Link href="/legal/terms?from=payments#payments" className="mt-2 inline-block text-forest underline decoration-1 underline-offset-4">
          Payment terms
        </Link>
      </aside>
      <Link href="/dashboard/payments" className="mt-4 inline-block text-sm font-medium text-forest">
        Back to payment settings
      </Link>
      </div>
    </main>
  );
}

function InfoTable({ headers, rows }: { headers: [string, string]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="hidden grid-cols-[11rem_minmax(0,1fr)] border-b border-line bg-paper-deep text-sm font-medium sm:grid">
        <p className="px-4 py-2">{headers[0]}</p>
        <p className="px-4 py-2">{headers[1]}</p>
      </div>
      <div className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row[0]} className="grid gap-1 px-4 py-3 text-sm leading-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-0 sm:px-0 sm:py-0">
            <p className="font-medium sm:px-4 sm:py-3">{row[0]}</p>
            <p className="text-muted sm:px-4 sm:py-3 sm:text-ink">{row[1]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
