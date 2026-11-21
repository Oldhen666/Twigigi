export const BUY_PLAN_CURRENCY = "CAD";
export const BUY_PLAN_CEILING_CENTS = 5999;

export type BuyPlanId = "buy_now_10" | "buy_now_20" | "buy_now_50" | "buy_now_unlimited";

export type BuyPlan = {
  id: BuyPlanId;
  name: string;
  listings: number | null;
  monthlyCents: number;
};

export const BUY_PLANS: readonly BuyPlan[] = [
  { id: "buy_now_10", name: "10 Listings", listings: 10, monthlyCents: 1299 },
  { id: "buy_now_20", name: "20 Listings", listings: 20, monthlyCents: 2299 },
  { id: "buy_now_50", name: "50 Listings", listings: 50, monthlyCents: 4499 },
  { id: "buy_now_unlimited", name: "Unlimited", listings: null, monthlyCents: 5999 },
];

export type BuySubscription = {
  userId: string;
  planId: string;
  extraSlots: number;
  status: string;
  paidUntil: string;
  anchorDay: number;
  autoRenew: boolean;
  graceUntil: string;
  pendingPlanId: string;
  pendingExtraSlots: number;
  currency: string;
};

export type BuyQuote = {
  plan: BuyPlan;
  extraSlots: number;
  listingLimit: number | null;
  monthlyCents: number;
};

export type BuyOption = {
  planId: BuyPlanId;
  name: string;
  extraSlots: number;
  listingLimit: number | null;
  monthlyCents: number;
  purchasable: boolean;
};

export type BuyRecommendation = {
  addSlots: number;
  targetSlots: number;
  published: number;
  currentSlots: number | null;
  currentMonthlyCents: number;
  stay: BuyOption | null;
  recommended: BuyOption;
  unlimited: BuyOption | null;
  savingsCents: number;
  gainedSlots: number | null;
};

export type BuyChange =
  | { ok: false; reason: "invalid" | "extra" | "quota"; limit: number | null; published: number }
  | { ok: true; kind: "same" }
  | { ok: true; kind: "switch_free"; planId: BuyPlanId; extraSlots: number }
  | {
      ok: true;
      kind: "bill";
      mode: "first" | "add" | "switch";
      planId: BuyPlanId;
      extraSlots: number;
      chargeCents: number;
      eventKey: string;
      periodEnd: string;
    };

const PLAN_IDS = new Set<string>(BUY_PLANS.map((plan) => plan.id));

export function buyPlan(id: string): BuyPlan | null {
  return BUY_PLANS.find((plan) => plan.id === id) ?? null;
}

export function bundleMonthlyCents(plan: BuyPlan, extraSlots: number) {
  if (!Number.isInteger(extraSlots) || extraSlots < 0 || extraSlots > 9_999) return null;
  if (plan.listings == null) return extraSlots === 0 ? plan.monthlyCents : null;
  const slots = plan.listings;
  return Math.floor((plan.monthlyCents * (slots + extraSlots) + Math.floor(slots / 2)) / slots);
}

export function quoteBuyPlan(planId: string, extraSlots: number): BuyQuote | null {
  const plan = buyPlan(planId);
  if (!plan) return null;
  const monthlyCents = bundleMonthlyCents(plan, extraSlots);
  if (monthlyCents == null) return null;
  return {
    plan,
    extraSlots,
    listingLimit: plan.listings == null ? null : plan.listings + extraSlots,
    monthlyCents,
  };
}

export function subscriptionCoversBuy(sub: BuySubscription | null, now = Date.now()) {
  if (!sub || !buyPlan(sub.planId) || sub.extraSlots < 0) return false;
  if (sub.status === "grace") {
    const ends = Date.parse(sub.graceUntil);
    return Number.isFinite(ends) && ends > now;
  }
  if (sub.status !== "active") return false;
  if (sub.autoRenew) return true;
  const until = Date.parse(sub.paidUntil);
  return Number.isFinite(until) && until > now;
}

export function activeBuyQuote(sub: BuySubscription | null, now = Date.now()): BuyQuote | null {
  if (!sub || !subscriptionCoversBuy(sub, now)) return null;
  return quoteBuyPlan(sub.planId, sub.extraSlots);
}

export function buyListingUsesBundle(cta: string, covered: boolean) {
  return cta === "buy" && covered;
}

function slotRank(limit: number | null) {
  return limit == null ? Number.POSITIVE_INFINITY : limit;
}

function toOption(quote: BuyQuote): BuyOption {
  return {
    planId: quote.plan.id,
    name: quote.plan.name,
    extraSlots: quote.extraSlots,
    listingLimit: quote.listingLimit,
    monthlyCents: quote.monthlyCents,
    purchasable: quote.monthlyCents <= BUY_PLAN_CEILING_CENTS,
  };
}

function sameOption(left: BuyOption, right: BuyOption) {
  return left.planId === right.planId && left.extraSlots === right.extraSlots;
}

export function recommendBuyTarget(input: {
  current: BuyQuote | null;
  published: number;
  addSlots: number;
}): BuyRecommendation | null {
  if (!Number.isInteger(input.addSlots) || input.addSlots < 1 || input.published < 0) return null;
  if (input.current?.listingLimit == null && input.current) {
    const stay = toOption(input.current);
    return {
      addSlots: input.addSlots,
      targetSlots: input.published,
      published: input.published,
      currentSlots: null,
      currentMonthlyCents: input.current.monthlyCents,
      stay,
      recommended: stay,
      unlimited: null,
      savingsCents: 0,
      gainedSlots: 0,
    };
  }
  const currentSlots = input.current?.listingLimit ?? 0;
  const targetSlots = Math.max(currentSlots + input.addSlots, input.published);
  const options: BuyOption[] = [];
  if (input.current) {
    const extra = targetSlots - input.current.plan.listings!;
    const stayQuote = quoteBuyPlan(input.current.plan.id, extra);
    if (stayQuote) options.push(toOption(stayQuote));
  }
  for (const plan of BUY_PLANS) {
    if (plan.listings == null) {
      const quote = quoteBuyPlan(plan.id, 0);
      if (quote) options.push(toOption(quote));
      continue;
    }
    if (input.current && plan.listings <= input.current.plan.listings!) continue;
    const extra = Math.max(0, targetSlots - plan.listings);
    const quote = quoteBuyPlan(plan.id, extra);
    if (quote) options.push(toOption(quote));
  }
  const stay = input.current ? options.find((option) => option.planId === input.current?.plan.id) ?? null : null;
  const unlimited = options.find((option) => option.planId === "buy_now_unlimited") ?? null;
  const buyable = options.filter((option) => option.purchasable);
  buyable.sort((left, right) => left.monthlyCents - right.monthlyCents || slotRank(right.listingLimit) - slotRank(left.listingLimit));
  const recommended = buyable[0];
  if (!recommended) return null;
  const savingsCents = stay && !sameOption(stay, recommended) ? Math.max(0, stay.monthlyCents - recommended.monthlyCents) : 0;
  const basis = stay?.listingLimit ?? targetSlots;
  const gainedSlots = recommended.listingLimit == null ? null : Math.max(0, recommended.listingLimit - basis);
  return {
    addSlots: input.addSlots,
    targetSlots,
    published: input.published,
    currentSlots: input.current ? currentSlots : 0,
    currentMonthlyCents: input.current?.monthlyCents ?? 0,
    stay,
    recommended,
    unlimited: unlimited && !sameOption(unlimited, recommended) ? unlimited : null,
    savingsCents,
    gainedSlots,
  };
}

export function optionAllowed(recommendation: BuyRecommendation, planId: string, extraSlots: number) {
  const matches = (option: BuyOption | null) => Boolean(option && option.purchasable && option.planId === planId && option.extraSlots === extraSlots);
  return matches(recommendation.recommended) || matches(recommendation.unlimited) || matches(recommendation.stay);
}

function withinQuota(limit: number | null, published: number) {
  return limit == null || published <= limit;
}

export function buyPlanChange(input: {
  userId: string;
  current: BuySubscription | null;
  planId: string;
  extraSlots: number;
  published: number;
  now: string;
}): BuyChange {
  const next = quoteBuyPlan(input.planId, input.extraSlots);
  if (!buyPlan(input.planId)) return { ok: false, reason: "invalid", limit: null, published: input.published };
  if (!next) return { ok: false, reason: "extra", limit: null, published: input.published };
  if (!withinQuota(next.listingLimit, input.published)) {
    return { ok: false, reason: "quota", limit: next.listingLimit, published: input.published };
  }
  if (next.monthlyCents > BUY_PLAN_CEILING_CENTS) {
    return { ok: false, reason: "extra", limit: next.listingLimit, published: input.published };
  }
  const now = Date.parse(input.now);
  const covered = subscriptionCoversBuy(input.current, Number.isFinite(now) ? now : Date.now());
  const currentQuote = covered && input.current ? quoteBuyPlan(input.current.planId, input.current.extraSlots) : null;
  if (currentQuote && currentQuote.plan.id === next.plan.id && currentQuote.extraSlots === next.extraSlots) {
    return { ok: true, kind: "same" };
  }
  if (!covered || !input.current || !currentQuote) {
    return {
      ok: true,
      kind: "bill",
      mode: "first",
      planId: next.plan.id,
      extraSlots: next.extraSlots,
      chargeCents: next.monthlyCents,
      eventKey: `buy|first|${next.plan.id}|${next.extraSlots}|${input.userId}`,
      periodEnd: "",
    };
  }
  if (next.monthlyCents > currentQuote.monthlyCents) {
    const mode = currentQuote.plan.id === next.plan.id ? "add" : "switch";
    return {
      ok: true,
      kind: "bill",
      mode,
      planId: next.plan.id,
      extraSlots: next.extraSlots,
      chargeCents: next.monthlyCents - currentQuote.monthlyCents,
      eventKey: `buy|${mode}|${next.plan.id}|${next.extraSlots}|${input.userId}|${input.current.paidUntil}`,
      periodEnd: input.current.paidUntil,
    };
  }
  return { ok: true, kind: "switch_free", planId: next.plan.id, extraSlots: next.extraSlots };
}

export function parseBuyEvent(key: string): { mode: "first" | "add" | "switch" | "renew"; planId: BuyPlanId; extraSlots: number } | null {
  const parts = key.split("|");
  if (parts[0] !== "buy" || parts.length < 5) return null;
  const mode = parts[1];
  if (mode !== "first" && mode !== "add" && mode !== "switch" && mode !== "renew") return null;
  if (!PLAN_IDS.has(parts[2])) return null;
  const plan = buyPlan(parts[2]);
  const extraSlots = Number(parts[3]);
  if (!plan || quoteBuyPlan(plan.id, extraSlots) == null) return null;
  return { mode, planId: plan.id, extraSlots };
}

export function buyPublishMessage(result: { reason: string; limit: number | null; published: number }) {
  if (result.reason === "quota") {
    const limit = result.limit ?? 0;
    return `This Buy Now bundle covers ${limit} published listing${limit === 1 ? "" : "s"}. ${result.published} are published now. The draft is saved. Add listing slots, or switch to a bundle that covers them.`;
  }
  return "The draft is saved. Choose a Buy Now bundle before publishing.";
}

export function buyChangeMessage(reason: string) {
  if (reason === "quota") return "That bundle does not cover the listings already published. Unpublish enough listings first. Listings and past orders stay.";
  if (reason === "extra") return "That slot count is above the C$59.99 Buy Now maximum. Unlimited is C$59.99 per month.";
  if (reason === "pending") return "A Buy Now bundle payment is still open. Twigigi will not start a second charge for it.";
  if (reason === "choice") return "Confirm the quoted bundle again. The price was checked on the server.";
  if (reason === "invalid") return "Choose one of the Buy Now bundles.";
  return "Could not change the Buy Now bundle.";
}
