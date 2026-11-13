import { connection } from "next/server";
import { redirect } from "next/navigation";
import { confirmProviderPayment, collectionOwnerId } from "@/lib/db";
import { capturePaypalOrder, PaypalCheckoutError } from "@/lib/paypal";

export async function GET(request: Request) {
  await connection();
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) redirect("/billing/complete?state=incomplete");
  try {
    const capture = await capturePaypalOrder(token, "");
    if (!capture.orderId.startsWith("collection:")) redirect("/billing/complete?state=incomplete");
    const collectionId = capture.orderId.slice("collection:".length);
    const userId = collectionOwnerId(collectionId);
    if (!userId) redirect("/billing/complete?state=incomplete");
    confirmProviderPayment({
      provider: "paypal",
      transactionId: capture.captureId,
      userId,
      collectionId,
      paidAt: new Date().toISOString(),
      succeeded: true,
    });
    redirect(`/billing/complete?state=confirmed&collection=${encodeURIComponent(collectionId)}`);
  } catch (error) {
    if (error instanceof PaypalCheckoutError) redirect("/billing/complete?state=incomplete");
    throw error;
  }
}
