import { findUserById, getOrder, getProductById, markFileSent, recordDirectFilePayment, recordSellerPaypalPayment } from "@/lib/db";
import { appUrl, formatMoney } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mail";
import type { PaypalCapture } from "@/lib/paypal";
import { safeEmail, safePhone } from "@/lib/payments";

export async function fulfillPaypalDigitalOrder(capture: PaypalCapture) {
  const order = getOrder(capture.orderId);
  if (!order || order.fulfillment !== "digital" || order.status === "canceled") return false;
  const expected = order.totalCents || order.amountCents;
  const currency = order.currency === "USD" ? "USD" : "CAD";
  if (capture.amountCents !== expected || capture.currency !== currency) return false;
  const product = getProductById(order.productId);
  const payee = safeEmail(product?.paypalEmail ?? "");
  if (!payee) return false;
  if (capture.payeeEmail && capture.payeeEmail.toLowerCase() !== payee) return false;
  if (!recordSellerPaypalPayment(order.id, capture.captureId)) return false;
  const fresh = getOrder(order.id);
  if (fresh && !fresh.fileSentAt) {
    const sent = await deliverPaidFile(order.id);
    if (sent) markFileSent(order.id, order.sellerId);
  }
  return true;
}

export async function fulfillStripeDigitalOrder(orderId: string, payment: { amountCents: number; currency: string; paymentId: string }) {
  const order = getOrder(orderId);
  if (!order || order.fulfillment !== "digital" || order.status === "canceled") return false;
  const expected = order.totalCents || order.amountCents;
  const currency = order.currency === "USD" ? "USD" : "CAD";
  if (payment.amountCents !== expected || payment.currency !== currency) return false;
  if (!recordDirectFilePayment(order.id, "stripe", payment.paymentId)) return false;
  const fresh = getOrder(order.id);
  if (fresh && !fresh.fileSentAt) {
    const sent = await deliverPaidFile(order.id);
    if (sent) markFileSent(order.id, order.sellerId);
  }
  return true;
}

export async function deliverPaidFile(orderId: string) {
  const order = getOrder(orderId);
  if (!order || order.fileLinks.length === 0) return false;
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  if (!paid) return false;
  const lines = [
    "Your file from Twigigi is ready.",
    "",
    order.productTitle,
    order.publicRef ? `Order: ${order.publicRef}` : null,
    "",
    ...order.fileLinks.map((link, index) => `Link ${index + 1}: ${link}`),
    order.filePassword ? `Password: ${order.filePassword}` : null,
    "",
    `Open the order: ${appUrl()}/order/${order.id}`,
  ].filter((line): line is string => line !== null);
  return sendOrderEmail(order.email, { subject: `Your file: ${order.productTitle}`, text: lines.join("\n") });
}

export async function sendPaymentConfirmed(orderId: string) {
  const order = getOrder(orderId);
  if (!order || order.fulfillment !== "digital") return false;
  const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
  if (!paid) return false;
  const product = getProductById(order.productId);
  const seller = findUserById(order.sellerId);
  const contact = sellerReach(product?.sellerContactMode ?? "email", product?.sellerContact ?? "", seller?.email ?? "");
  const lines = [
    "Your payment is confirmed.",
    "",
    order.productTitle,
    order.publicRef ? `Order: ${order.publicRef}` : null,
    `Total: ${formatMoney(order.totalCents || order.amountCents, order.currency)}`,
    "",
    `Seller: ${order.displayName}`,
    contact ? `Contact: ${contact}` : null,
    "",
    "The file link and password arrive in a separate email after the seller sends them.",
    `Open the order: ${appUrl()}/order/${order.id}`,
  ].filter((line): line is string => line !== null);
  return sendOrderEmail(order.email, { subject: `Payment confirmed: ${order.productTitle}`, text: lines.join("\n") });
}

function sellerReach(mode: string, contact: string, fallbackEmail: string) {
  if (mode === "phone") return safePhone(contact);
  return safeEmail(contact) || safeEmail(fallbackEmail);
}
