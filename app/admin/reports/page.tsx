import Link from "next/link";
import { AdminListTools } from "@/components/admin-list-tools";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { listContentReports } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { REPORT_STATUSES, listingReasonLabel, reportStatusLabel, rightTypeLabel } from "@/lib/legal";

const KINDS = ["", "listing", "ip"] as const;
const SORTS = ["newest", "oldest"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = queryValue(params.q);
  const status = pick(queryValue(params.status), REPORT_STATUSES);
  const kind = pick(queryValue(params.kind), KINDS);
  const sort = pick(queryValue(params.sort), SORTS, "newest");
  const all = listContentReports();
  const reports = sortRows(
    all.filter((report) => {
      if (status && report.status !== status) return false;
      if (kind && report.kind !== kind) return false;
      return includesText(q, [report.productTitle, report.reporterEmail, report.reporterName, report.reason, report.contentUrl, report.ownerName, listingReasonLabel(report.reason)]);
    }),
    (report) => report.createdAt,
    sort === "oldest" ? "asc" : "desc",
  );
  const empty = emptyListMessage(reports.length, all.length, "No reports yet.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Reports</h1>
      <p className="mt-2 text-sm text-muted">A report does not remove a listing. Review it, then restrict or restore the Twig if needed.</p>
      <AdminListTools
        path="/admin/reports"
        q={q}
        shown={reports.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
        ]}
        filters={[
          { name: "status", label: "Status", value: status, options: [{ value: "", label: "Any status" }, ...REPORT_STATUSES.map((item) => ({ value: item, label: reportStatusLabel(item) }))] },
          { name: "kind", label: "Type", value: kind, options: [{ value: "", label: "Any type" }, { value: "listing", label: "Listing" }, { value: "ip", label: "Intellectual property" }] },
        ]}
      />
      {empty ? <p className="mt-6 text-sm text-muted">{empty}</p> : (
      <ul className="mt-6 space-y-3">
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
      )}
    </main>
  );
}
