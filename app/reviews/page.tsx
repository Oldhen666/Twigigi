import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { ReviewForm } from "@/components/review-form";
import { requireUser } from "@/lib/auth";
import { listReviewableInteractions, listUserReviews } from "@/lib/db";
import { formatDate } from "@/lib/format";

async function ReviewsScreen() {
  const user = await requireUser();
  const waiting = listReviewableInteractions(user.id, user.email);
  const reviews = listUserReviews(user.id);
  return (
    <AccountFrame section="reviews" title="Reviews" lede="A review opens after you mark the interaction completed. Both sides confirming makes it a verified transaction.">
      {waiting.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No confirmed interactions are waiting for a review.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {waiting.map((item) => (
            <li key={item.id}>
              <ReviewForm interactionId={item.id} kind={item.kind} productTitle={`${item.publicRef} · ${item.productTitle}`} />
            </li>
          ))}
        </ul>
      )}
      {reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Yours</h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
                <p className="font-medium">{review.productTitle}</p>
                <p className="text-muted">{review.publicRef} · {review.overall}/5 overall · {formatDate(review.createdAt)}</p>
                <p className="mt-1 text-muted">As described {review.asDescribed} · Communication {review.communication} · Reliability {review.reliability}{review.quality != null ? ` · Quality ${review.quality}` : ""}</p>
                {review.body ? <p className="mt-2">{review.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading reviews…</p>}>
      <ReviewsScreen />
    </Suspense>
  );
}

export const metadata = { title: "Reviews", robots: { index: false, follow: false } };
