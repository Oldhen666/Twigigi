export function PaymentRiskNote({ cash }: { cash: boolean }) {
  if (cash) {
    return (
      <p className="text-sm leading-6 text-muted">
        You pay the seller in cash at pickup. Twigigi does not take the payment. It stays unpaid until the seller confirms they received the cash.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm leading-6">
      <p>You pay the seller directly. Twigigi does not hold, escrow, or guarantee this payment.</p>
      <p className="rounded-2xl bg-red-50 px-3 py-2 text-danger">
        Sending money before you receive the item is risky, especially if you do not know the seller. Only continue if you trust them.
      </p>
    </div>
  );
}
