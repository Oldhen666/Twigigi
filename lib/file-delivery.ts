import { getOrder } from "@/lib/db";
import { appUrl } from "@/lib/format";
import { sendOrderEmail } from "@/lib/mail";

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
