import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { saveProduct } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { DeleteTwig } from "@/components/delete-twig";
import { ProductForm } from "@/components/product-form";
import { findUserById, getProductById } from "@/lib/db";

async function Editor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSeller();
  const { id } = await params;
  const query = await searchParams;
  const product = getProductById(id);
  const owner = product && product.userId !== user.id && user.role === "admin" ? findUserById(product.userId) : user;
  if (!product || !owner || (product.userId !== user.id && user.role !== "admin")) notFound();
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-serif text-4xl">Edit Twig</h1>
      {user.role === "admin" && product.userId !== user.id ? (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          Editing as admin · Seller: {owner.displayName}
          <Link href="/admin/twigs" className="mt-2 block font-medium text-forest">Back to Admin Twigs</Link>
        </p>
      ) : null}
      {query.saved === "1" ? <p className="mt-3 rounded-xl bg-moss px-3 py-2 text-sm text-forest">Draft saved.</p> : null}
      {query.blocked === "1" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          This draft has orders or leads, so it stays in your records.
        </p>
      ) : null}
      {query.blocked === "live" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          A live Twig cannot be deleted. Deactivate it from the dashboard first.
        </p>
      ) : null}
      <ProductForm action={saveProduct} product={product} defaultEmail={owner.email} sellerName={owner.displayName} cta={product.cta} stripeReady={owner.stripeChargesEnabled} />
      {product.status === "published" ? (
        <p className="mt-6 text-sm text-muted">
          This Twig is live, so it cannot be deleted. Deactivate it from the dashboard. The page becomes inactive. Turn it back on before the next charge date and you will not be charged again. If you do not reactivate, it is permanently deleted 30 days after it deactivates.
        </p>
      ) : (
        <div className="mt-6">
          {product.status === "deactivated" ? (
            <p className="mb-2 text-sm text-muted">
              This Twig is deactivated. You can delete it now, or reactivate it from the dashboard before it is permanently deleted.
            </p>
          ) : null}
          <DeleteTwig productId={product.id} mode={product.status === "deactivated" ? "deactivated" : "draft"} />
        </div>
      )}
    </main>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading editor…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}
