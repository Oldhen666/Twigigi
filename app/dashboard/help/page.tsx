export const metadata = { title: "Help", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Help</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>Orders are placed right away. Buyers pay you directly. Twigigi does not hold or guarantee the product payment.</p>
        <p>Cash is only for local pickup. Confirm the pickup time, tell the buyer when it is ready, then confirm the cash and the handover together. The order is complete when you confirm both.</p>
        <p>For e-Transfer, PayPal, or Venmo, confirm the payment only after you see the money. Then prepare pickup or shipping. Cancel an order you cannot fulfill.</p>
        <p>Confirmed paid is the amount you reported as received. Unpaid order value is still waiting for that confirmation. The two numbers stay separate. They are not added into a sales total, and they are not money Twigigi collected.</p>
      </div>
    </main>
  );
}
