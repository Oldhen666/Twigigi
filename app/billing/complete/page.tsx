import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { collectionForSeller } from "@/lib/db";
import { safeNext } from "@/lib/format";
import { getStripe } from "@/lib/stripe";

function draftReturn(value: string) {
  const next = safeNext(value);
  return next.startsWith("/dashboard/buy?draft=") ? next : "";
}

function listingReturn(value: string) {
  return draftReturn(value).includes("fee=listing");
}

async function CompleteScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const state = typeof params.state === "string" ? params.state : "";
  const collectionId = typeof params.collection === "string" ? params.collection : "";
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const draft = draftReturn(typeof params.next === "string" ? params.next : "");
  const listing = listingReturn(typeof params.next === "string" ? params.next : "");
  if (state === "incomplete") {
    return (
      <main className="page-frame py-16">
        <h1 className="font-serif text-4xl">Payment not completed</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{draft ? "Nothing was marked paid. The Twig is still a draft." : "Nothing was marked paid. The listing period was not changed."}</p>
        {draft ? <Link href={draft} className="mt-6 inline-block text-sm font-medium text-forest">Back to this Twig</Link> : <Link href="/dashboard/payments?tab=receipts" className="mt-6 inline-block text-sm font-medium text-forest">Back to billing</Link>}
      </main>
    );
  }
  const collection = collectionId ? collectionForSeller(collectionId, user.id) : null;
  let stripePaid = false;
  if (sessionId) {
    const stripe = getStripe();
    if (!stripe) redirect("/dashboard");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.userId !== user.id) redirect("/dashboard");
    stripePaid = session.payment_status === "paid";
    const fromSession = session.metadata?.collectionId || "";
    const stored = fromSession ? collectionForSeller(fromSession, user.id) : collection;
    return (
      <main className="page-frame py-16">
        <h1 className="font-serif text-4xl">{stored?.status === "paid" ? "Payment confirmed" : stripePaid ? "Payment received" : "Payment not completed"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          {stored?.status === "paid"
            ? listing
              ? "The listing payment is confirmed. This Twig is published."
              : draft
                ? "The subscription is confirmed. This Twig is still a draft until you publish it."
                : "The signed payment confirmation updated this bill and the listing period."
            : stripePaid
              ? listing
                ? "Stripe has accepted the payment. This Twig publishes when that payment is confirmed."
                : draft
                  ? "Stripe has accepted the payment. This Twig stays a draft until the subscription is confirmed and you publish it."
                  : "Stripe has accepted the payment. The listing period changes only after the signed webhook is confirmed."
              : draft
                ? "This payment was not completed. Nothing was marked paid. The draft is saved."
                : "This payment was not completed. Nothing was marked paid."}
        </p>
        {draft ? <Link href={draft} className="mt-6 inline-block text-sm font-medium text-forest">{listing ? "Back to this Twig" : stored?.status === "paid" || stripePaid ? "Publish Twig" : "Back to this Twig"}</Link> : <Link href="/dashboard/payments?tab=receipts" className="mt-6 inline-block text-sm font-medium text-forest">Back to billing</Link>}
      </main>
    );
  }
  return (
    <main className="page-frame py-16">
      <h1 className="font-serif text-4xl">{collection?.status === "paid" ? "Payment confirmed" : "Waiting for confirmation"}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        {collection?.status === "paid"
          ? listing
            ? "The listing payment is confirmed. This Twig is published."
            : draft
              ? "The subscription is confirmed. This Twig is still a draft until you publish it."
              : "The payment was confirmed on the server. Refresh is safe and will not extend the listing again."
          : draft
            ? "The payment is not confirmed yet. The draft is saved."
            : "This page only shows the payment status. It does not decide whether the payment succeeded."}
      </p>
      {draft ? <Link href={draft} className="mt-6 inline-block text-sm font-medium text-forest">{listing || collection?.status !== "paid" ? "Back to this Twig" : "Publish Twig"}</Link> : <Link href="/dashboard/payments?tab=receipts" className="mt-6 inline-block text-sm font-medium text-forest">Back to billing</Link>}
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Checking payment status…</p>}>
      <CompleteScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Payment", robots: { index: false, follow: false } };
