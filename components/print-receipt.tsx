"use client";

export function PrintReceipt({
  orderNumber,
  rows,
  label = "Print receipt",
  className = "",
}: {
  orderNumber: string;
  rows: { label: string; value: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.7in; }
          body * { visibility: hidden; }
          #order-receipt, #order-receipt * { visibility: visible; }
          #order-receipt {
            position: absolute;
            top: 0;
            left: 0;
            display: block !important;
            width: 100%;
            background: white;
            color: black;
          }
        }
      `}</style>
      <button type="button" onClick={() => window.print()} className={className || "ml-auto shrink-0 text-sm font-medium text-forest"}>
        {label}
      </button>
      <section id="order-receipt" className="hidden print:block">
        <p className="text-xs font-medium uppercase tracking-[0.16em]">Twigigi</p>
        <h1 className="mt-2 font-serif text-4xl">Receipt</h1>
        {orderNumber ? <p className="mt-2 text-sm">Order #{orderNumber}</p> : null}
        <dl className="mt-8 max-w-md space-y-4 text-sm">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`}>
              <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{row.label}</dt>
              <dd className="mt-1">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
