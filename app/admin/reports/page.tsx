import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listContentReports } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { REPORT_STATUSES, listingReasonLabel, reportStatusLabel, rightTypeLabel } from "@/lib/legal";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const status = typeof params.status === "string" && REPORT_STATUSES.some((item) => item === params.status) ? params.status : "";
  const reports = listContentReports(status);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Reports</h1>
      <p className="mt-2 text-sm text-muted">A report does not remove a listing. Review it, then restrict or restore the Twig if needed.</p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/reports" className={status === "" ? "text-ink" : "text-forest"}>All</Link>
        {REPORT_STATUSES.map((item) => (
          <Link key={item} href={`/admin/reports?status=${item}`} className={status === item ? "text-ink" : "text-forest"}>{reportStatusLabel(item)}</Link>
        ))}
      </nav>
      <ul className="mt-6 space-y-3">
        {reports.length === 0 ? <li className="text-sm text-muted">No reports in this view.</li> : null}
        {reports.map((report) => (
          <li key={report.id}>
            <Link href={`/admin/reports/${report.id}`} className="block rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <span className="font-medium">{report.kind === "ip" ? "Intellectual property" : listingReasonLabel(report.reason)}</span>
              <span className="text-muted"> · {reportStatusLabel(report.status)} · {formatDate(report.createdAt)}</span>
              <p className="mt-1 text-muted">{report.productTitle || report.contentUrl || "No listing matched"} · {report.reporterEmail}</p>
              {report.kind === "ip" && report.rightType ? <p className="text-muted">{rightTypeLabel(report.rightType)}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
