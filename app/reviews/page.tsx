import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { ReviewForm } from "@/components/review-form";
import { requireUser } from "@/lib/auth";
import { listReviewableOrders, listUserReviews } from "@/lib/db";
import { formatDate } from "@/lib/format";

async function ReviewsScreen() {
  const user = await requireUser();
  const waiting = listReviewableOrders(user.id);
  const reviews = listUserReviews(user.id);
  return (
    <AccountFrame title="Reviews" lede="A review is available after the seller marks the order fulfilled.">
      {waiting.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No fulfilled orders are waiting for a review.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {waiting.map((order) => (
            <li key={order.id}>
              <ReviewForm orderId={order.id} productTitle={order.publicRef ? `${order.publicRef} · ${order.productTitle}` : order.productTitle} />
            </li>
          ))}
        </ul>
      )}
      {reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Yours</h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="font-medium">{review.productTitle}</p>
                <p className="text-sm text-muted">{review.rating}/5 · {formatDate(review.createdAt)}</p>
                {review.body ? <p className="mt-2 text-sm">{review.body}</p> : null}
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
