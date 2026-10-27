import { redirect } from "next/navigation";
import { Suspense } from "react";
import { activeWindow, twigMonthlyCents } from "@/lib/billing";
import { requireUser } from "@/lib/auth";
import { productTag, sellerTag } from "@/lib/catalog";
import { getProductById, publishDraft, reactivateProduct, recordTwigBill } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { updateTag } from "next/cache";

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `bill_${Buffer.from(bytes).toString("base64url")}`;
}

async function CompleteScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const user = await requireUser();
  const stripe = getStripe();
  if (!stripe || !sessionId) redirect("/dashboard");
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" || session.metadata?.purpose !== "twig" || session.metadata.userId !== user.id) {
    redirect("/dashboard");
  }
  const product = getProductById(session.metadata.productId || "");
  if (!product || product.userId !== user.id || product.status === "published") redirect("/dashboard");
  if (product.status === "deactivated") reactivateProduct(product.id, user.id);
  else if (product.status === "draft") publishDraft(product.id, user.id);
  const cents = twigMonthlyCents() ?? session.amount_total ?? 0;
  const window = activeWindow(new Date().toISOString());
  recordTwigBill({
    id: newId(),
    userId: user.id,
    productId: product.id,
    amountCents: cents,
    method: user.billingMethod || "stripe",
    periodStart: window.start,
    periodEnd: window.end,
    status: "paid",
  });
  updateTag(productTag(user.username, product.slug));
  updateTag(sellerTag(user.username));
  redirect("/dashboard");
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Confirming payment…</p>}>
      <CompleteScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Payment", robots: { index: false, follow: false } };
