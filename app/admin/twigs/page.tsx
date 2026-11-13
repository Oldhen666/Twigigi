import Link from "next/link";
import { AdminListTools } from "@/components/admin-list-tools";
import { adminSetTwig, duplicateTwig, setListingFree, setQuoteFeeFree } from "@/lib/actions";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { listAllProducts } from "@/lib/db";

const STATUSES = ["", "published", "draft", "deactivated", "ending"] as const;
const TYPES = ["", "buy", "quote", "file", "contact"] as const;
const FEES = ["", "free", "waived", "standard"] as const;
const SORTS = ["updated", "title", "seller"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const q = queryValue(query.q);
  const status = pick(queryValue(query.status), STATUSES);
  const type = pick(queryValue(query.type), TYPES);
  const fee = pick(queryValue(query.fee), FEES);
  const sort = pick(queryValue(query.sort), SORTS, "updated");
  const all = listAllProducts();
  const products = sortRows(
    all.filter((product) => {
      if (status === "ending" && !product.deactivatesAt) return false;
      if (status && status !== "ending" && product.status !== status) return false;
      if (type && product.cta !== type) return false;
      if (fee === "free" && !product.feeExempt) return false;
      if (fee === "waived" && !product.quoteFeeExempt) return false;
      if (fee === "standard" && (product.feeExempt || product.quoteFeeExempt)) return false;
      return includesText(q, [product.title, product.displayName, product.username, product.slug]);
    }),
    (product) => (sort === "title" ? product.title : sort === "seller" ? product.displayName : product.updatedAt),
    sort === "updated" ? "desc" : "asc",
  );
  const empty = emptyListMessage(products.length, all.length, "No Twigs yet.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Twigs</h1>
      <p className="mt-2 text-sm text-muted">Edit any Twig, or deactivate and reactivate it.</p>
      <AdminListTools
        path="/admin/twigs"
        q={q}
        shown={products.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "updated", label: "Recently updated" },
          { value: "title", label: "Title" },
          { value: "seller", label: "Seller" },
        ]}
        filters={[
          { name: "status", label: "Status", value: status, options: [{ value: "", label: "Any status" }, { value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "deactivated", label: "Deactivated" }, { value: "ending", label: "Ending" }] },
          { name: "type", label: "Type", value: type, options: [{ value: "", label: "Any type" }, { value: "buy", label: "Buy now" }, { value: "quote", label: "Quote" }, { value: "file", label: "Digital file" }, { value: "contact", label: "Contact" }] },
          { name: "fee", label: "Fee", value: fee, options: [{ value: "", label: "Any fee" }, { value: "standard", label: "Standard" }, { value: "free", label: "Free forever" }, { value: "waived", label: "Quote fee waived" }] },
        ]}
      />
      {empty ? <p className="mt-6 text-sm text-muted">{empty}</p> : (
      <ul className="mt-6 space-y-3">
        {products.map((product) => (
          <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{product.title}</p>
              <p className="text-muted">{product.displayName} · {product.status}{product.deactivatesAt ? " · ending" : ""}{product.feeExempt ? " · free forever" : ""}{product.cta === "quote" && product.quoteFeeExempt ? " · quote fee waived" : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/products/${product.id}?from=admin`} className="text-forest">Edit</Link>
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
      )}
    </main>
  );
}
