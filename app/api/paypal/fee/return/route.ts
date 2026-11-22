import { connection } from "next/server";
import { redirect } from "next/navigation";
import { confirmProviderPayment, collectionOwnerId } from "@/lib/db";
import { safeNext } from "@/lib/format";
import { capturePaypalOrder, PaypalCheckoutError } from "@/lib/paypal";

function feeNext(request: Request) {
  const next = safeNext(new URL(request.url).searchParams.get("next") || "");
  return next.startsWith("/dashboard/buy?draft=") ? `&next=${encodeURIComponent(next)}` : "";
}

export async function GET(request: Request) {
  await connection();
  const token = new URL(request.url).searchParams.get("token") || "";
  const next = feeNext(request);
  if (!token) redirect(`/billing/complete?state=incomplete${next}`);
  try {
    const capture = await capturePaypalOrder(token, "");
    if (!capture.orderId.startsWith("collection:")) redirect(`/billing/complete?state=incomplete${next}`);
    const collectionId = capture.orderId.slice("collection:".length);
    const userId = collectionOwnerId(collectionId);
    if (!userId) redirect(`/billing/complete?state=incomplete${next}`);
    confirmProviderPayment({
      provider: "paypal",
      transactionId: capture.captureId,
      userId,
      collectionId,
      paidAt: new Date().toISOString(),
      succeeded: true,
    });
    redirect(`/billing/complete?state=confirmed&collection=${encodeURIComponent(collectionId)}${next}`);
  } catch (error) {
    if (error instanceof PaypalCheckoutError) redirect(`/billing/complete?state=incomplete${next}`);
    throw error;
  }
}
