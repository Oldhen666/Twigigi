export const DIGITAL_PLAN_CURRENCY = "CAD";

export type DigitalPlanId = "starter" | "creator" | "growth" | "pro" | "unlimited";

export type DigitalPlan = {
  id: DigitalPlanId;
  name: string;
  listingsPerCopy: number | null;
  monthlyCents: number;
  feeBps: number;
  stackable: boolean;
};

export const DIGITAL_PLANS: readonly DigitalPlan[] = [
  { id: "starter", name: "Starter", listingsPerCopy: 5, monthlyCents: 149, feeBps: 300, stackable: false },
  { id: "creator", name: "Creator", listingsPerCopy: 10, monthlyCents: 1499, feeBps: 150, stackable: true },
  { id: "growth", name: "Growth", listingsPerCopy: 20, monthlyCents: 1499, feeBps: 300, stackable: true },
  { id: "pro", name: "Pro", listingsPerCopy: 50, monthlyCents: 2599, feeBps: 200, stackable: true },
  { id: "unlimited", name: "Unlimited", listingsPerCopy: null, monthlyCents: 5099, feeBps: 50, stackable: false },
];

export type DigitalSubscription = {
  userId: string;
  planId: string;
  copies: number;
  status: string;
  paidUntil: string;
  anchorDay: number;
  autoRenew: boolean;
  graceUntil: string;
  pendingPlanId: string;
  pendingCopies: number;
  currency: string;
};

export type PlanQuote = {
  plan: DigitalPlan;
  copies: number;
  listingLimit: number | null;
  monthlyCents: number;
  feeBps: number;
};

export type PlanAlternative = {
  plan: DigitalPlan;
  copies: 1;
  listingLimit: number | null;
  monthlyCents: number;
  feeBps: number;
};

export type PlatformFeePath = "stripe_connect" | "paypal_checkout" | "external" | "manual" | "buy_now" | "quote";

export type PlatformFeeSnapshot = {
  feeBps: number;
  feeCents: number;
  collected: boolean;
  reason: string;
};

const PLAN_IDS = new Set<string>(DIGITAL_PLANS.map((plan) => plan.id));

export function digitalPlan(id: string): DigitalPlan | null {
  return DIGITAL_PLANS.find((plan) => plan.id === id) ?? null;
}

export function planCopies(plan: DigitalPlan, copies: number): number | null {
  if (!Number.isInteger(copies) || copies < 1 || copies > 99) return null;
  if (!plan.stackable && copies !== 1) return null;
  return copies;
}

export function quoteDigitalPlan(planId: string, copies: number): PlanQuote | null {
  const plan = digitalPlan(planId);
  if (!plan) return null;
  const count = planCopies(plan, copies);
  if (count == null) return null;
  return {
    plan,
    copies: count,
    listingLimit: plan.listingsPerCopy == null ? null : plan.listingsPerCopy * count,
    monthlyCents: plan.monthlyCents * count,
    feeBps: plan.feeBps,
  };
}

export function formatFeeRate(feeBps: number) {
  return `${(feeBps / 100).toFixed(2)}%`;
}

export function listingLimitLabel(limit: number | null) {
  return limit == null ? "Unlimited" : String(limit);
}

export function subscriptionCovers(sub: DigitalSubscription | null, now = Date.now()) {
  if (!sub || !digitalPlan(sub.planId) || sub.copies < 1) return false;
  if (sub.status === "grace") {
    const ends = Date.parse(sub.graceUntil);
    return Number.isFinite(ends) && ends > now;
  }
  if (sub.status !== "active") return false;
  if (sub.autoRenew) return true;
  const until = Date.parse(sub.paidUntil);
  return Number.isFinite(until) && until > now;
}

export function activePlanQuote(sub: DigitalSubscription | null, now = Date.now()): PlanQuote | null {
  if (!sub || !subscriptionCovers(sub, now)) return null;
  return quoteDigitalPlan(sub.planId, sub.copies);
}

export function singlePlanAlternative(selection: PlanQuote): PlanAlternative | null {
  let best: PlanAlternative | null = null;
  for (const plan of DIGITAL_PLANS) {
    if (plan.id === selection.plan.id) continue;
    const quote = quoteDigitalPlan(plan.id, 1);
    if (!quote) continue;
    const enough = quote.listingLimit == null || (selection.listingLimit != null && quote.listingLimit >= selection.listingLimit);
    if (!enough || quote.monthlyCents > selection.monthlyCents || quote.feeBps > selection.feeBps) continue;
    if (
      quote.monthlyCents === selection.monthlyCents &&
      quote.feeBps === selection.feeBps &&
      quote.listingLimit === selection.listingLimit
    ) {
      continue;
    }
    if (!best || quote.monthlyCents < best.monthlyCents || (quote.monthlyCents === best.monthlyCents && quote.feeBps < best.feeBps)) {
      best = { plan, copies: 1, listingLimit: quote.listingLimit, monthlyCents: quote.monthlyCents, feeBps: quote.feeBps };
    }
  }
  return best;
}

export function platformOrderFeeCents(amountCents: number, feeBps: number) {
  if (!Number.isInteger(amountCents) || amountCents < 1) return 0;
  if (!Number.isInteger(feeBps) || feeBps < 1) return 0;
  return Math.floor((amountCents * feeBps + 5_000) / 10_000);
}

export function platformFeeCapability(path: PlatformFeePath) {
  if (path === "stripe_connect") {
    return {
      confirmsPayment: true,
      collectsApplicationFee: false,
      reason:
        "Stripe confirms a digital-file card payment on the seller's connected account. The checkout does not set an application fee, and connected accounts are created with Stripe as the fee collector.",
    };
  }
  if (path === "paypal_checkout") {
    return {
      confirmsPayment: true,
      collectsApplicationFee: false,
      reason: "PayPal confirms the capture and pays the seller's PayPal email. The checkout does not set a platform fee.",
    };
  }
  return {
    confirmsPayment: false,
    collectsApplicationFee: false,
    reason: "External payment links and manual payments do not create a Twigigi platform fee.",
  };
}

export function snapshotPlatformFee(input: {
  path: PlatformFeePath;
  amountCents: number;
  feeBps: number;
  planActive: boolean;
}): PlatformFeeSnapshot {
  const capability = platformFeeCapability(input.path);
  if (!input.planActive || !capability.confirmsPayment || !capability.collectsApplicationFee) {
    const applicable = input.planActive && capability.confirmsPayment ? input.feeBps : 0;
    return {
      feeBps: applicable,
      feeCents: applicable > 0 ? platformOrderFeeCents(input.amountCents, applicable) : 0,
      collected: false,
      reason: capability.reason,
    };
  }
  return {
    feeBps: input.feeBps,
    feeCents: platformOrderFeeCents(input.amountCents, input.feeBps),
    collected: true,
    reason: "",
  };
}

export function fileListingUsesStorePlan(cta: string, covered: boolean) {
  return cta === "file" && covered;
}

export type PlanChange =
  | { ok: false; reason: "invalid" | "copies" | "quota"; limit: number | null; published: number }
  | { ok: true; kind: "same" }
  | { ok: true; kind: "schedule"; planId: DigitalPlanId; copies: number }
  | { ok: true; kind: "switch_free"; planId: DigitalPlanId; copies: number }
  | {
      ok: true;
      kind: "bill";
      mode: "first" | "add" | "switch";
      planId: DigitalPlanId;
      copies: number;
      chargeCents: number;
      eventKey: string;
      periodEnd: string;
    };

function withinQuota(limit: number | null, published: number) {
  return limit == null || published <= limit;
}

export function planChange(input: {
  userId: string;
  current: DigitalSubscription | null;
  planId: string;
  copies: number;
  published: number;
  now: string;
}): PlanChange {
  const plan = digitalPlan(input.planId);
  if (!plan) return { ok: false, reason: "invalid", limit: null, published: input.published };
  if (planCopies(plan, input.copies) == null) return { ok: false, reason: "copies", limit: null, published: input.published };
  const next = quoteDigitalPlan(plan.id, input.copies);
  if (!next) return { ok: false, reason: "invalid", limit: null, published: input.published };
  if (!withinQuota(next.listingLimit, input.published)) {
    return { ok: false, reason: "quota", limit: next.listingLimit, published: input.published };
  }
  const now = Date.parse(input.now);
  const covered = subscriptionCovers(input.current, Number.isFinite(now) ? now : Date.now());
  const currentQuote = covered && input.current ? quoteDigitalPlan(input.current.planId, input.current.copies) : null;
  if (currentQuote && currentQuote.plan.id === next.plan.id && currentQuote.copies === next.copies) {
    return { ok: true, kind: "same" };
  }
  if (!covered || !input.current || !currentQuote) {
    return {
      ok: true,
      kind: "bill",
      mode: "first",
      planId: next.plan.id,
      copies: next.copies,
      chargeCents: next.monthlyCents,
      eventKey: `digital|first|${next.plan.id}|${next.copies}|${input.userId}`,
      periodEnd: "",
    };
  }
  if (currentQuote.plan.id === next.plan.id && next.copies > currentQuote.copies) {
    return {
      ok: true,
      kind: "bill",
      mode: "add",
      planId: next.plan.id,
      copies: next.copies,
      chargeCents: next.plan.monthlyCents * (next.copies - currentQuote.copies),
      eventKey: `digital|add|${next.plan.id}|${next.copies}|${input.userId}|${input.current.paidUntil}`,
      periodEnd: input.current.paidUntil,
    };
  }
  if (next.monthlyCents > currentQuote.monthlyCents) {
    return {
      ok: true,
      kind: "bill",
      mode: "switch",
      planId: next.plan.id,
      copies: next.copies,
      chargeCents: next.monthlyCents - currentQuote.monthlyCents,
      eventKey: `digital|switch|${next.plan.id}|${next.copies}|${input.userId}|${input.current.paidUntil}`,
      periodEnd: input.current.paidUntil,
    };
  }
  if (next.monthlyCents === currentQuote.monthlyCents) {
    return { ok: true, kind: "switch_free", planId: next.plan.id, copies: next.copies };
  }
  return { ok: true, kind: "schedule", planId: next.plan.id, copies: next.copies };
}

export function parseDigitalEvent(key: string): { mode: "first" | "add" | "switch" | "renew"; planId: DigitalPlanId; copies: number } | null {
  const parts = key.split("|");
  if (parts[0] !== "digital" || parts.length < 5) return null;
  const mode = parts[1];
  if (mode !== "first" && mode !== "add" && mode !== "switch" && mode !== "renew") return null;
  if (!PLAN_IDS.has(parts[2])) return null;
  const plan = digitalPlan(parts[2]);
  const copies = Number(parts[3]);
  if (!plan || planCopies(plan, copies) == null) return null;
  return { mode, planId: plan.id, copies };
}

export function digitalPublishMessage(result: { reason: string; limit: number | null; published: number }) {
  if (result.reason === "quota") {
    const limit = result.limit ?? 0;
    return `This Digital File plan covers ${limit} published listing${limit === 1 ? "" : "s"}. ${result.published} are published now. Unpublish one before publishing another. The draft is saved. Files, listings, and past orders stay.`;
  }
  return "The draft is saved. Choose a Digital File plan before publishing.";
}

export function digitalChangeMessage(reason: string, limit: number | null, published: number) {
  if (reason === "quota") {
    const cap = limit == null ? "unlimited listings" : `${limit} published listing${limit === 1 ? "" : "s"}`;
    return `That plan covers ${cap}. ${published} are published now. Unpublish enough listings before changing the plan. Files, listings, and past orders stay.`;
  }
  if (reason === "copies") return "Starter and Unlimited stay at one copy. Monthly renewal is still available.";
  if (reason === "pending") return "A Digital File plan payment is still open. Twigigi will not start a second charge for it.";
  if (reason === "invalid") return "Choose one of the Digital File plans.";
  return "Could not change the Digital File plan.";
}
