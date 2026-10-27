import { adminRemoveReview, adminSaveReview } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listAllReviews } from "@/lib/db";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const reviews = listAllReviews();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Reviews</h1>
      <p className="mt-2 text-sm text-muted">Edit the scores and text, or remove a review.</p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {reviews.length === 0 ? <p className="mt-8 text-sm text-muted">No reviews yet.</p> : null}
      <ul className="mt-6 space-y-4">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-medium">{review.displayName} · {review.productTitle}</p>
            <p className="text-sm text-muted">{review.publicRef}</p>
            <form action={adminSaveReview} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={review.id} />
              <Score name="overall" label="Overall" value={review.overall} />
              <Score name="asDescribed" label="As described" value={review.asDescribed} />
              <Score name="communication" label="Communication" value={review.communication} />
              <Score name="reliability" label="Reliability" value={review.reliability} />
              {review.quality != null ? <Score name="quality" label="Quality" value={review.quality} /> : null}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Review</span>
                <textarea name="body" defaultValue={review.body} rows={3} className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
              </label>
              <button className="inline-flex h-9 items-center justify-center rounded-full bg-forest px-4 text-sm text-card">Save review</button>
            </form>
            <form action={adminRemoveReview} className="mt-2">
              <input type="hidden" name="id" value={review.id} />
              <button className="text-sm text-danger">Remove review</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Score({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <select name={name} defaultValue={String(value)} className="h-10 w-full rounded-xl border border-line bg-white px-2 text-sm">
        {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score}</option>)}
      </select>
    </label>
  );
}
