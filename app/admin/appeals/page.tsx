import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listCopyrightAppeals } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function Page() {
  await requireAdmin();
  const appeals = listCopyrightAppeals();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Copyright review requests</h1>
      <ul className="mt-6 space-y-3">
        {appeals.length === 0 ? <li className="text-sm text-muted">No review requests yet.</li> : null}
        {appeals.map((appeal) => (
          <li key={appeal.id} className="rounded-3xl border border-line bg-card p-4 text-sm">
            <Link href={`/admin/appeals/${appeal.id}`} className="font-medium text-forest">{appeal.sellerName || appeal.userId}</Link>
            <p className="text-muted">{appeal.status} · {formatDate(appeal.createdAt)}{appeal.productTitle ? ` · ${appeal.productTitle}` : ""}</p>
            <p className="mt-2 line-clamp-2">{appeal.statement}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
