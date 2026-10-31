import { redirect } from "next/navigation";
import { resolveSellerRoute } from "@/lib/db";

export function sellerPath(segment: string, rest = "") {
  const route = resolveSellerRoute(segment);
  if (!route) return null;
  if (route.redirect) redirect(`/${route.publicId}${rest}`);
  return route.publicId;
}
