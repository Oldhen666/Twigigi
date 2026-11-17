import { COPYRIGHT_POLICY_VERSION } from "@/lib/legal";

export function digitalContentVersion(fileLinks: string[], images: string[]) {
  const body = JSON.stringify({
    links: fileLinks.map((item) => item.trim()).filter(Boolean),
    images: images.map((item) => item.trim()).filter(Boolean),
  });
  let hash = 5381;
  for (let index = 0; index < body.length; index += 1) hash = ((hash * 33) ^ body.charCodeAt(index)) >>> 0;
  return hash.toString(16);
}

export function digitalRightsDue(input: {
  confirmed: boolean;
  confirmedVersion: string;
  confirmedPolicy: string;
  fileLinks: string[];
  images: string[];
  imagesChanged: boolean;
}) {
  if (!input.confirmed || input.confirmedPolicy !== COPYRIGHT_POLICY_VERSION) return true;
  if (input.imagesChanged) return true;
  return input.confirmedVersion !== digitalContentVersion(input.fileLinks, input.images);
}

export function twigigiFileHeld(
  product: { fileAccess?: string; moderationStatus?: string } | null,
  seller: { suspended?: boolean; banned?: boolean } | null,
) {
  if (!product) return false;
  if (product.fileAccess === "restricted" || product.moderationStatus === "restricted") return true;
  if (seller?.suspended || seller?.banned) return true;
  return false;
}

export function sellerMayPublish(user: { suspended?: boolean; banned?: boolean; publishRestricted?: boolean }) {
  return !user.suspended && !user.banned && !user.publishRestricted;
}

export function enforcementNotice(input: { productTitle: string; actionLabel: string; reason: string; deadline: string | null }) {
  return [
    input.productTitle ? `Listing: ${input.productTitle}` : "Listing: not tied to one Twig",
    `Action: ${input.actionLabel}`,
    `Reason: ${input.reason}`,
    input.deadline ? `Respond by: ${input.deadline}` : "",
    "Request a review: /legal/copyright-appeal",
    "A review request does not restore a listing or account by itself.",
    "Twigigi can stop access through Twigigi. It cannot delete a file hosted outside Twigigi, or a copy a buyer already downloaded.",
  ].filter(Boolean).join("\n");
}

export const ENFORCEMENT_ACTIONS = [
  "request_documents",
  "restrict_listing",
  "restore_listing",
  "restrict_files",
  "restore_files",
  "restrict_publishing",
  "restore_publishing",
  "suspend",
  "unsuspend",
  "ban",
  "unban",
] as const;

export type EnforcementAction = (typeof ENFORCEMENT_ACTIONS)[number];

export function enforcementLabel(action: string) {
  if (action === "request_documents") return "Request supporting documents";
  if (action === "restrict_listing") return "Pause listing";
  if (action === "restore_listing") return "Restore listing";
  if (action === "restrict_files") return "Restrict file access on Twigigi";
  if (action === "restore_files") return "Restore file access on Twigigi";
  if (action === "restrict_publishing") return "Restrict publishing";
  if (action === "restore_publishing") return "Restore publishing";
  if (action === "suspend") return "Suspend account";
  if (action === "unsuspend") return "Unsuspend account";
  if (action === "ban") return "Terminate account";
  if (action === "unban") return "Restore terminated account";
  return action;
}

export function enforcementNeedsConfirm(action: string) {
  return action === "restrict_listing" || action === "restrict_files" || action === "restrict_publishing" || action === "suspend" || action === "ban";
}
