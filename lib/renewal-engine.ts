import { cardCanRenew, outcomeForIntent, renewalStep, type IntentStatus } from "@/lib/billing-auth";
import {
  claimSellerCharge,
  confirmProviderPayment,
  findUserById,
  holdSellerCollection,
  listRenewalCollections,
  rememberCollectionPayment,
} from "@/lib/db";
import { createOffSessionFeePayment, findCollectionIntent, retrieveFeeIntent } from "@/lib/stripe";

function applyOutcome(input: { userId: string; collectionId: string; paymentId: string; outcome: "paid" | "failed" | "unknown" | "action_required" }) {
  const paidAt = new Date().toISOString();
  if ((input.outcome === "paid" || input.outcome === "failed") && input.paymentId) {
    confirmProviderPayment({
      provider: "stripe",
      transactionId: input.paymentId,
      userId: input.userId,
      collectionId: input.collectionId,
      paidAt,
      succeeded: input.outcome === "paid",
    });
    return;
  }
  holdSellerCollection({
    collectionId: input.collectionId,
    userId: input.userId,
    paymentId: input.paymentId,
    status: input.outcome === "action_required" ? "action_required" : "unknown",
  });
}

export function autoChargeEnabled() {
  return process.env.BILLING_AUTO_CHARGE === "1";
}

export async function settleRenewalCollections(chargeEnabled = autoChargeEnabled()) {
  let changed = 0;
  for (const row of listRenewalCollections()) {
    const user = findUserById(row.userId);
    if (!user) continue;
    const authorized = cardCanRenew({
      method: user.billingMethod,
      ready: user.billingReady,
      authStatus: user.billingAuthStatus,
      paymentMethodId: user.billingPmId,
      consentVersion: user.billingConsentVersion,
    });
    let paymentId = row.paymentId;
    let intent: IntentStatus | null = null;
    if (paymentId) {
      const found = await retrieveFeeIntent(paymentId);
      intent = found?.status ?? "unknown";
    } else if (row.providerOrderId === "charging" && user.stripeCustomerId) {
      const found = await findCollectionIntent(user.stripeCustomerId, row.id);
      if (found) {
        paymentId = found.id;
        intent = found.status;
        rememberCollectionPayment(row.id, row.userId, found.id);
      }
    }
    const step = renewalStep({ chargeEnabled, authorized, collectionStatus: row.status, paymentId, intent });
    if (step === "idle") continue;
    if (step === "create") {
      if (!claimSellerCharge(row.id, row.userId)) continue;
      const created = await createOffSessionFeePayment({
        customerId: user.stripeCustomerId,
        paymentMethodId: user.billingPmId,
        amountCents: row.amountCents,
        currency: row.currency,
        collectionId: row.id,
        userId: row.userId,
        idempotencyKey: row.idempotencyKey,
      });
      if (created.id) rememberCollectionPayment(row.id, row.userId, created.id);
      applyOutcome({ userId: row.userId, collectionId: row.id, paymentId: created.id, outcome: outcomeForIntent(created.id ? created.status : "unknown") });
      changed += 1;
      continue;
    }
    applyOutcome({ userId: row.userId, collectionId: row.id, paymentId, outcome: step });
    changed += 1;
  }
  return changed;
}
