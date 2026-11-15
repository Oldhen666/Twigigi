export const metadata = { title: "Help", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Help</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <h2 id="bank" className="scroll-mt-24 font-serif text-2xl">How seller payments go to your bank account</h2>
        <p>Buy now payments do not pass through Twigigi. Interac e-Transfer, Venmo, and PayPal.Me are paid to the account you save. Cash is paid to you at pickup. Those providers move the money to your bank when you withdraw it.</p>
        <p>Card payments on digital files go to your connected Stripe account. Stripe sends payouts to the bank account you add during Stripe setup. PayPal payments for digital files go to the PayPal email you save.</p>
        <p>Twigigi does not receive these payments and does not deposit them into a bank account for you.</p>
        <p>Orders are placed right away. Buyers pay you directly. Twigigi does not hold or guarantee the product payment.</p>
        <p>Cash is only for local pickup. Confirm the pickup time, tell the buyer when it is ready, then confirm the cash and the handover together. The order is complete when you confirm both.</p>
        <p>For e-Transfer, PayPal, or Venmo, confirm the payment only after you see the money. Then prepare pickup or shipping. Cancel an order you cannot fulfill.</p>
        <p>Confirmed paid is the amount you reported as received. Unpaid order value is still waiting for that confirmation. The two numbers stay separate. They are not added into a sales total, and they are not money Twigigi collected.</p>
      </div>
    </main>
  );
}
