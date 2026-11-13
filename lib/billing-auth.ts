export const BILLING_CONSENT_VERSION = "2026-11-13";

export type IntentStatus =
  | "succeeded"
  | "processing"
  | "requires_action"
  | "requires_payment_method"
  | "canceled"
  | "unknown";

export type RenewalStep = "idle" | "create" | "paid" | "failed" | "unknown" | "action_required";

export function cardCanRenew(input: {
  method: string;
  ready: boolean;
  authStatus: string;
  paymentMethodId: string;
  consentVersion: string;
}) {
  return input.method === "card"
    && input.ready
    && input.authStatus === "authorized"
    && input.paymentMethodId.startsWith("pm_")
    && input.consentVersion === BILLING_CONSENT_VERSION;
}

export function setupAuthorization(input: {
  purpose?: string;
  userId?: string;
  expectedUserId: string;
  sessionComplete: boolean;
  intentStatus?: string;
  usage?: string;
  paymentMethodId?: string;
  customerId?: string;
  consentVersion?: string;
}) {
  if (input.purpose !== "billing_setup") return "incomplete" as const;
  if (!input.expectedUserId || input.userId !== input.expectedUserId) return "incomplete" as const;
  if (!input.sessionComplete) return "incomplete" as const;
  if (input.consentVersion !== BILLING_CONSENT_VERSION) return "incomplete" as const;
  if (!input.customerId) return "incomplete" as const;
  if (input.intentStatus === "requires_action") return "action_required" as const;
  if (input.intentStatus !== "succeeded") return "incomplete" as const;
  if (input.usage !== "off_session") return "incomplete" as const;
  if (!input.paymentMethodId?.startsWith("pm_")) return "incomplete" as const;
  return "authorized" as const;
}

export function outcomeForIntent(status: IntentStatus | null): Exclude<RenewalStep, "idle" | "create"> {
  if (status === "succeeded") return "paid";
  if (status === "requires_action") return "action_required";
  if (status === "processing" || status === "unknown" || !status) return "unknown";
  return "failed";
}

export function renewalStep(input: {
  chargeEnabled: boolean;
  authorized: boolean;
  collectionStatus: string;
  paymentId: string;
  intent: IntentStatus | null;
}): RenewalStep {
  if (input.collectionStatus === "paid" || input.collectionStatus === "failed") return "idle";
  if (!input.paymentId) {
    if (!input.chargeEnabled || !input.authorized) return "idle";
    return "create";
  }
  return outcomeForIntent(input.intent);
}
