import { connection } from "next/server";
import { redirect } from "next/navigation";
import { capturePaypalOrder, PaypalCheckoutError } from "@/lib/paypal";
import { fulfillPaypalDigitalOrder } from "@/lib/file-delivery";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") || "";
  const paypalOrderId = url.searchParams.get("token") || "";
  if (!orderId || !paypalOrderId) redirect("/");
  try {
    const capture = await capturePaypalOrder(paypalOrderId, orderId);
    if (capture.orderId !== orderId) redirect(`/order/${orderId}?paypal=error`);
    const settled = await fulfillPaypalDigitalOrder(capture);
    redirect(settled ? `/order/${orderId}` : `/order/${orderId}?paypal=error`);
  } catch (error) {
    if (error instanceof PaypalCheckoutError) redirect(`/order/${orderId}?paypal=error`);
    throw error;
  }
}
