"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ghostClass, inputClass, labelClass } from "@/components/ui";

export type SellerQuoteRow = {
  id: string;
  productId: string;
  productTitle: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  quantity: number;
  projectDetails: string;
  status: string;
  createdAt: string;
  submitted: string;
  billable: boolean;
  feeReason: string;
  offer: string;
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
  { value: "twig", label: "Twig" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

export function SellerQuotes({ quotes }: { quotes: SellerQuoteRow[] }) {
  const [productId, setProductId] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const products = useMemo(() => {
    const seen = new Map<string, string>();
    for (const quote of quotes) seen.set(quote.productId, quote.productTitle);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [quotes]);
  const shown = useMemo(() => {
    const rows = quotes.filter((quote) => !productId || quote.productId === productId);
    rows.sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "name") return a.name.localeCompare(b.name) || b.createdAt.localeCompare(a.createdAt);
      if (sort === "twig") return a.productTitle.localeCompare(b.productTitle) || b.createdAt.localeCompare(a.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return rows;
  }, [quotes, productId, sort]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className={labelClass}>Twig</span>
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}>
            <option value="">All Twigs</option>
            {products.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </label>
        <label className="w-full sm:w-44">
          <span className={labelClass}>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className={inputClass}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => downloadQuotes(shown)} disabled={shown.length === 0} className={`${ghostClass} w-full sm:w-fit`}>
          Export Excel
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No quotes for this Twig.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((quote) => (
            <li key={quote.id}>
              <Link href={`/dashboard/quotes/${quote.id}`} className="block rounded-2xl border border-line bg-card p-4 text-sm">
                <p className="font-medium">{quote.name}</p>
                <p className="text-muted">{quote.productTitle} · qty {quote.quantity}</p>
                <p className="mt-1 text-muted">{quote.status} · {quote.submitted} · {feeLabel(quote)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function feeLabel(quote: SellerQuoteRow) {
  if (quote.billable) return "On the next bill";
  if (quote.feeReason === "waived") return "Quote fee waived";
  return "Not billed again";
}

function downloadQuotes(quotes: SellerQuoteRow[]) {
  const headers = ["Name", "Email", "Phone", "Twig", "Quantity", "Status", "Submitted", "Message", "Project details", "Offer"];
  const rows = quotes.map((quote) => [
    quote.name,
    quote.email,
    quote.phone,
    quote.productTitle,
    String(quote.quantity),
    quote.status,
    quote.submitted,
    quote.message,
    quote.projectDetails,
    quote.offer,
  ]);
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Quotes"><Table>
<Row>${headers.map((cell) => dataCell(cell)).join("")}</Row>
${rows.map((row) => `<Row>${row.map((cell) => dataCell(cell)).join("")}</Row>`).join("")}
</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "twigigi-quotes.xls";
  link.click();
  URL.revokeObjectURL(url);
}

function dataCell(value: string) {
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
}
