import { collectDueSellerFees } from "@/lib/seller-fees";
import { deliverBillingNotices } from "@/lib/billing-mail";
import { autoChargeEnabled, settleRenewalCollections } from "@/lib/renewal-engine";

export async function POST(request: Request) {
  const secret = process.env.BILLING_CRON_SECRET || "";
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const prepared = await collectDueSellerFees();
  const changed = await settleRenewalCollections(autoChargeEnabled());
  const mailed = await deliverBillingNotices();
  return Response.json({ prepared: prepared.users, settled: changed, mailed, autoCharge: autoChargeEnabled() });
}
