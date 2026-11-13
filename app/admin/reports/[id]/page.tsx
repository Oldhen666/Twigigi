import Link from "next/link";
import { notFound } from "next/navigation";
import { adminRestoreReportedListing, adminSuspendAccount, adminUpdateReport } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { findUserById, getContentReport, listModerationEvents } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { REPORT_STATUSES, listingReasonLabel, reportStatusLabel, rightTypeLabel } from "@/lib/legal";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const report = getContentReport(id);
  if (!report) notFound();
  const owner = report.ownerUserId ? findUserById(report.ownerUserId) : null;
  const events = listModerationEvents("report", report.id);
  const listingEvents = report.productId ? listModerationEvents("product", report.productId) : [];
  const trail = [...events, ...listingEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <Link href="/admin/reports" className="text-sm text-forest">Reports</Link>
      <h1 className="mt-2 font-serif text-4xl">{report.kind === "ip" ? "Intellectual property report" : "Listing report"}</h1>
      <p className="mt-2 text-sm text-muted">{reportStatusLabel(report.status)} · {formatDate(report.createdAt)}</p>

      <section className="mt-6 space-y-2 rounded-3xl border border-line bg-card p-5 text-sm">
        <p><span className="text-muted">Reporter.</span> {report.reporterName} · {report.reporterEmail}</p>
        {report.company ? <p><span className="text-muted">Company.</span> {report.company}</p> : null}
        {report.reporterUserId ? <p className="text-muted">Signed-in reporter {report.reporterUserId}</p> : <p className="text-muted">Reporter was not signed in.</p>}
        <p><span className="text-muted">Listing owner.</span> {report.ownerName || "Not matched"}{report.ownerEmail ? ` · ${report.ownerEmail}` : ""}</p>
        {report.productId ? (
          <p>
            <span className="text-muted">Listing.</span> {report.productTitle || report.productId}
            {report.publicId && report.productSlug ? <> · <Link href={`/${report.publicId}/${report.productSlug}`} className="text-forest">Open</Link></> : null}
            {" "}· <Link href={`/dashboard/products/${report.productId}?from=admin`} className="text-forest">Edit</Link>
            {report.moderationStatus === "restricted" ? <span className="text-muted"> · Hidden from the public page</span> : null}
          </p>
        ) : <p className="text-muted">No Twig matched this URL. Review the address below.</p>}
        {report.reason ? <p><span className="text-muted">Reason.</span> {listingReasonLabel(report.reason)}</p> : null}
        {report.rightType ? <p><span className="text-muted">Right.</span> {rightTypeLabel(report.rightType)}</p> : null}
        {report.protectedWork ? <p className="whitespace-pre-wrap"><span className="text-muted">Protected work.</span> {report.protectedWork}</p> : null}
        <p className="break-all"><span className="text-muted">URL.</span> {report.contentUrl}</p>
        <p className="whitespace-pre-wrap"><span className="text-muted">Description.</span> {report.description}</p>
        {report.evidence ? <p className="whitespace-pre-wrap"><span className="text-muted">Evidence.</span> {report.evidence}</p> : null}
        <p><span className="text-muted">Signature.</span> {report.signature}</p>
        <p className="text-muted">Policy version {report.policyVersion || "not recorded"}</p>
      </section>

      <form action={adminUpdateReport} className="mt-6 space-y-3 rounded-3xl border border-line bg-card p-5">
        <input type="hidden" name="id" value={report.id} />
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={report.status} className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3">
            {REPORT_STATUSES.map((status) => <option key={status} value={status}>{reportStatusLabel(status)}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Internal note</span>
          <textarea name="adminNote" rows={4} defaultValue={report.adminNote} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" />
        </label>
        <p className="text-xs text-muted">Choosing Content restricted also hides the Twig from its public page. It does not delete it.</p>
        <button className="rounded-full bg-forest px-4 py-2 text-sm text-card">Save review</button>
      </form>

      {report.productId && report.moderationStatus === "restricted" ? (
        <form action={adminRestoreReportedListing} className="mt-3">
          <input type="hidden" name="productId" value={report.productId} />
          <input type="hidden" name="reportId" value={report.id} />
          <button className="text-sm text-forest">Restore listing on the public page</button>
        </form>
      ) : null}
      {owner && owner.role !== "admin" ? (
        <form action={adminSuspendAccount} className="mt-2">
          <input type="hidden" name="userId" value={owner.id} />
          <input type="hidden" name="reportId" value={report.id} />
          <input type="hidden" name="suspended" value={owner.suspended ? "0" : "1"} />
          <button className="text-sm text-forest">{owner.suspended ? "Unsuspend listing owner" : "Suspend listing owner"}</button>
        </form>
      ) : null}

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Audit trail</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {trail.length === 0 ? <li className="text-muted">No moderation actions yet.</li> : null}
          {trail.map((event) => (
            <li key={event.id} className="rounded-2xl border border-line bg-card px-4 py-3">
              <p>{event.action}{event.toStatus ? ` · ${event.toStatus}` : ""}</p>
              <p className="text-muted">{event.actorName || event.actorId} · {formatDate(event.createdAt)}</p>
              {event.note ? <p className="mt-1 whitespace-pre-wrap">{event.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
