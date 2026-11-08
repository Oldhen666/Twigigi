import { connection } from "next/server";
import { requireSeller } from "@/lib/auth";
import { listSellerBills } from "@/lib/db";
import { platformFee } from "@/lib/billing";
import { billingYear } from "@/lib/format";
import { receiptPdf } from "@/lib/receipt-pdf";

export async function GET(request: Request) {
  await connection();
  const user = await requireSeller();
  const requested = new URL(request.url).searchParams.get("year") || "";
  const year = /^\d{4}$/.test(requested) ? requested : billingYear(new Date().toISOString());
  const bills = listSellerBills(user.id).filter((bill) => billingYear(bill.createdAt) === year && bill.status !== "accrued");
  const totals = new Map<string, number>();
  const lines = bills.map((bill) => {
    totals.set(bill.currency, (totals.get(bill.currency) ?? 0) + bill.amountCents);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "short", day: "numeric" }).format(new Date(bill.createdAt));
    const kind = bill.kind === "quote" ? "Quote request" : "Listing";
    return { date, description: `${kind} · ${bill.title}`, amount: platformFee(bill.amountCents, bill.currency) };
  });
  for (const [currency, cents] of totals) {
    lines.push({ date: "", description: `Total ${currency}`, amount: platformFee(cents, currency) });
  }
  const pdf = receiptPdf({ year, seller: user.displayName, lines });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="twigigi-statement-${year}.pdf"`,
    },
  });
}
