import { fulfillPaypalDigitalOrder } from "@/lib/file-delivery";
import { paypalConfigured, paypalWebhookVerified, readPaypalWebhookCapture } from "@/lib/paypal";

export async function POST(request: Request) {
  if (!paypalConfigured() || !process.env.PAYPAL_WEBHOOK_ID) return new Response("PayPal is not configured", { status: 501 });
  const body = await request.text();
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const verified = await paypalWebhookVerified(request.headers, event);
  if (!verified) return new Response("Invalid signature", { status: 400 });
  const capture = readPaypalWebhookCapture(event);
  if (capture) await fulfillPaypalDigitalOrder(capture);
  return new Response("ok");
}
