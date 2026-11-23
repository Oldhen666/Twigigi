"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
  const shownIds = shown.map((quote) => quote.id);
  const selectedCount = shownIds.filter((id) => selected.has(id)).length;
  const allVisible = shownIds.length > 0 && selectedCount === shownIds.length;

  function toggleQuote(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        <button type="button" onClick={() => downloadQuotes(shown.filter((quote) => selected.has(quote.id)))} disabled={selectedCount === 0} className={`${ghostClass} w-full sm:w-fit disabled:bg-paper-deep disabled:text-muted`}>
          Export selected
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No quotes for this Twig.</p>
      ) : (
        <>
          <SelectVisible allVisible={allVisible} selectedCount={selectedCount} onToggle={() => {
            setSelected((current) => {
              const next = new Set(current);
              if (allVisible) {
                for (const id of shownIds) next.delete(id);
              } else {
                for (const id of shownIds) next.add(id);
              }
              return next;
            });
          }} />
          <ul className="mt-3 space-y-3">
            {shown.map((quote) => (
              <li key={quote.id} className="relative flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
                {quote.status === "new" ? <QuoteMark /> : null}
                <input
                  type="checkbox"
                  checked={selected.has(quote.id)}
                  onChange={() => toggleQuote(quote.id)}
                  aria-label={`Select ${quote.name}`}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-forest"
                />
                <Link href={`/dashboard/quotes/${quote.id}`} className="min-w-0 flex-1">
                  <p className="font-medium">{quote.name}</p>
                  <p className="text-muted">{quote.productTitle} · qty {quote.quantity}</p>
                  <p className="mt-1 text-muted">{quote.status} · {quote.submitted} · {feeLabel(quote)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function SelectVisible({
  allVisible,
  selectedCount,
  onToggle,
}: {
  allVisible: boolean;
  selectedCount: number;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !allVisible;
  }, [allVisible, selectedCount]);
  return (
    <label className="mt-6 flex items-center gap-3 text-sm">
      <input
        ref={ref}
        type="checkbox"
        checked={allVisible}
        onChange={onToggle}
        aria-label="Select visible quotes"
        className="h-5 w-5 shrink-0 accent-forest"
      />
      <span>{selectedCount === 0 ? "Select all" : selectedCount === 1 ? "1 selected" : `${selectedCount} selected`}</span>
    </label>
  );
}

function QuoteMark() {
  return (
    <span className="group/mark absolute right-3 top-3">
      <button type="button" className="grid h-11 w-11 cursor-help place-items-center" aria-label="How to clear this mark">
        <span className="text-3xl font-bold leading-none text-danger">!</span>
      </button>
      <span className="absolute right-0 top-full z-20 hidden w-64 pt-2 group-hover/mark:block group-focus-within/mark:block">
        <span className="block rounded-2xl border border-line bg-card px-3 py-2 text-left text-xs font-normal leading-5 text-ink shadow-sm">
          Open this quote. Mark it as contacted, send a quote, or close the request. The mark goes away.
        </span>
      </span>
    </span>
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
