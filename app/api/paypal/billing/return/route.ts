import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { setBillingAuthorization } from "@/lib/db";
import { executePaypalBillingAgreement } from "@/lib/paypal";

export async function GET(request: Request) {
  const user = await requireSeller();
  const params = new URL(request.url).searchParams;
  const token = params.get("ba_token") || params.get("token") || "";
  try {
    const agreementId = await executePaypalBillingAgreement(token);
    setBillingAuthorization(user.id, { method: "paypal", ready: true, paypalBillingId: agreementId });
  } catch {
    redirect("/dashboard/payments?tab=receipts&billing=paypal&reason=PayPal%20did%20not%20finish%20the%20billing%20agreement.");
  }
  redirect("/dashboard/payments?tab=receipts");
}
