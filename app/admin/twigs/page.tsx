import Link from "next/link";
import { adminSetTwig, duplicateTwig, setListingFree, setQuoteFeeFree } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listAllProducts } from "@/lib/db";

export default async function Page() {
  await requireAdmin();
  const products = listAllProducts();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Twigs</h1>
      <p className="mt-2 text-sm text-muted">Edit any Twig, or deactivate and reactivate it.</p>
      <ul className="mt-6 space-y-3">
        {products.map((product) => (
          <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{product.title}</p>
              <p className="text-muted">{product.displayName} · {product.status}{product.deactivatesAt ? " · ending" : ""}{product.feeExempt ? " · free forever" : ""}{product.cta === "quote" && product.quoteFeeExempt ? " · quote fee waived" : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/products/${product.id}`} className="text-forest">Edit</Link>
              <form action={duplicateTwig}>
                <input type="hidden" name="id" value={product.id} />
                <button className="text-forest">Duplicate</button>
              </form>
              {product.cta === "quote" ? (
                <form action={setQuoteFeeFree}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="free" value={product.quoteFeeExempt ? "0" : "1"} />
                  <input type="hidden" name="next" value="/admin/twigs" />
                  <button className="text-forest">{product.quoteFeeExempt ? "Charge quote fee" : "Waive quote fee"}</button>
                </form>
              ) : null}
              <form action={setListingFree}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="free" value={product.feeExempt ? "0" : "1"} />
                <input type="hidden" name="next" value="/admin/twigs" />
                <button className="text-forest">{product.feeExempt ? "Charge this Twig" : "Make free forever"}</button>
              </form>
              {product.status === "published" ? <Link href={`/${product.publicId}/${product.slug}`} className="text-forest">Open</Link> : null}
              {product.status === "published" && !product.deactivatesAt ? (
                <form action={adminSetTwig}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="mode" value="deactivate" />
                  <button className="text-forest">Deactivate</button>
                </form>
              ) : null}
              {product.status === "deactivated" || product.deactivatesAt ? (
                <form action={adminSetTwig}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="mode" value="reactivate" />
                  <button className="text-forest">Reactivate</button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
