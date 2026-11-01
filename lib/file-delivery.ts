import { findUserById, getOrder, getProductById } from "@/lib/db";
import { appUrl, formatMoney } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mail";
import { safeEmail, safePhone } from "@/lib/payments";

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
