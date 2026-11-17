import Link from "next/link";
import { notFound } from "next/navigation";
import { adminReviewAppeal } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getCopyrightAppeal, listModerationEvents } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const appeal = getCopyrightAppeal(id);
  if (!appeal) notFound();
  const events = listModerationEvents("appeal", appeal.id);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <Link href="/admin/appeals" className="text-sm text-forest">Review requests</Link>
      <h1 className="mt-2 font-serif text-4xl">Review request</h1>
      <p className="mt-2 text-sm text-muted">{appeal.status} · {formatDate(appeal.createdAt)}</p>
      <section className="mt-6 space-y-2 rounded-3xl border border-line bg-card p-5 text-sm">
        <p><span className="text-muted">Seller.</span> {appeal.sellerName} · {appeal.sellerEmail}</p>
        <p><span className="text-muted">Listing.</span> {appeal.productTitle || "Not tied to one Twig"}</p>
        <p className="whitespace-pre-wrap">{appeal.statement}</p>
        {appeal.evidence ? <p className="whitespace-pre-wrap"><span className="text-muted">Evidence.</span> {appeal.evidence}</p> : null}
      </section>
      <form action={adminReviewAppeal} className="mt-6 space-y-3 rounded-3xl border border-line bg-card p-5">
        <input type="hidden" name="id" value={appeal.id} />
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={appeal.status} className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3">
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Internal note</span>
          <textarea name="adminNote" rows={4} defaultValue={appeal.adminNote} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2" />
        </label>
        <button className="rounded-full bg-forest px-4 py-2 text-sm text-card">Save review</button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-line bg-card px-4 py-3">
            <p>{event.action} · {event.toStatus}</p>
            <p className="text-muted">{formatDate(event.createdAt)}</p>
            {event.note ? <p className="mt-1 whitespace-pre-wrap">{event.note}</p> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
