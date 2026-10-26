import { notFound } from "next/navigation";
import { Suspense } from "react";
import { saveProduct } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { DeleteTwig } from "@/components/delete-twig";
import { ProductForm } from "@/components/product-form";
import { getProductById } from "@/lib/db";

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
  if (!product || product.userId !== user.id) notFound();
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-serif text-4xl">Edit Twig</h1>
      {query.saved === "1" ? <p className="mt-3 rounded-xl bg-moss px-3 py-2 text-sm text-forest">Draft saved.</p> : null}
      {query.blocked === "1" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          This draft has orders or leads, so it stays in your records.
        </p>
      ) : null}
      {query.blocked === "live" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          A live or deactivated Twig cannot be deleted. Deactivate it from the dashboard, then reactivate before it is permanently deleted.
        </p>
      ) : null}
      <ProductForm action={saveProduct} product={product} defaultEmail={user.email} sellerName={user.displayName} cta={product.cta} />
      {product.status === "draft" ? (
        <div className="mt-2">
          <DeleteTwig productId={product.id} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          {product.status === "published"
            ? "This Twig is live, so it cannot be deleted. Deactivate it from the dashboard. It stays up until the next billing date. If you do not reactivate, it is permanently deleted 30 days after it deactivates."
            : product.deactivatedAt
              ? "This Twig is deactivated. Reactivate it from the dashboard before the permanent deletion date."
              : "This Twig is deactivated. Reactivate it from the dashboard, or it is permanently deleted 30 days after it was deactivated."}
        </p>
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
