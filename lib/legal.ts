export const TERMS_VERSION = "2026-10-31";
export const PRIVACY_VERSION = "2026-10-31";
export const IP_POLICY_VERSION = "2026-10-31";

export const REPORT_STATUSES = [
  "submitted",
  "under_review",
  "action_required",
  "content_restricted",
  "resolved",
  "rejected",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function reportStatusLabel(status: string) {
  if (status === "under_review") return "Under review";
  if (status === "action_required") return "Action required";
  if (status === "content_restricted") return "Content restricted";
  if (status === "resolved") return "Resolved";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

export const LISTING_REPORT_REASONS = [
  { id: "ip", label: "Intellectual property infringement" },
  { id: "counterfeit", label: "Counterfeit product" },
  { id: "fraud", label: "Fraud or scam" },
  { id: "misleading", label: "Misleading information" },
  { id: "prohibited", label: "Prohibited product or service" },
  { id: "safety", label: "Safety concern" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Other" },
] as const;

export function listingReasonLabel(id: string) {
  return LISTING_REPORT_REASONS.find((reason) => reason.id === id)?.label ?? id;
}

export const RIGHT_TYPES = [
  { id: "copyright", label: "Copyright" },
  { id: "trademark", label: "Trademark" },
  { id: "industrial_design", label: "Industrial Design" },
  { id: "patent", label: "Patent" },
  { id: "other", label: "Other" },
] as const;

export function rightTypeLabel(id: string) {
  return RIGHT_TYPES.find((right) => right.id === id)?.label ?? id;
}

export const PROHIBITED_CATEGORIES = [
  {
    id: "illegal",
    title: "Illegal goods and services",
    body: "Do not list anything that is illegal to sell, offer, advertise, or possess in the place where it is offered or in Alberta. This includes goods or services that require a licence you do not have.",
  },
  {
    id: "fraud",
    title: "Fraud and scams",
    body: "Do not use a listing, quote, buy request, or message to mislead someone about who you are, what you are offering, the price, or whether a payment or delivery will happen.",
  },
  {
    id: "counterfeit",
    title: "Counterfeit goods",
    body: "Do not list counterfeit or pirated goods, or goods held out as a brand you are not authorized to sell.",
  },
  {
    id: "stolen",
    title: "Stolen property",
    body: "Do not list property you do not have the right to sell, including stolen goods.",
  },
  {
    id: "infringing",
    title: "Infringing content",
    body: "Do not upload or describe content that infringes copyright, trademark, patent, industrial design, trade secret, or other proprietary rights.",
  },
  {
    id: "unsafe",
    title: "Unsafe products and services",
    body: "Do not list products or services that create a serious safety risk, or that you cannot offer in a lawful and reasonably safe way.",
  },
  {
    id: "deceptive",
    title: "Deceptive listings",
    body: "Do not post a title, price, photo, brand, review, or description that you know is false or likely to mislead a buyer.",
  },
] as const;
