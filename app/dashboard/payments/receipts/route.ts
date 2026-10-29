import { connection } from "next/server";
import { requireSeller } from "@/lib/auth";
import { listSellerBills } from "@/lib/db";
import { billingYear, formatDate, formatMoney } from "@/lib/format";
import { receiptPdf } from "@/lib/receipt-pdf";

export async function GET(request: Request) {
  await connection();
  const user = await requireSeller();
  const requested = new URL(request.url).searchParams.get("year") || "";
  const year = /^\d{4}$/.test(requested) ? requested : billingYear(new Date().toISOString());
  const bills = listSellerBills(user.id).filter((bill) => billingYear(bill.createdAt) === year);
  const lines = [
    `Twigigi receipts ${year}`,
    user.displayName,
    "",
    ...(bills.length ? [] : ["No receipt for this year."]),
    ...bills.map((bill) => {
      const kind = bill.kind === "quote" ? "Quote request" : "Listing";
      return `${formatDate(bill.createdAt)}  ${kind}  ${bill.title}  ${bill.status}  ${formatMoney(bill.amountCents, bill.currency)} ${bill.currency}`;
    }),
  ];
  const pdf = receiptPdf(lines);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="twigigi-receipts-${year}.pdf"`,
    },
  });
}
