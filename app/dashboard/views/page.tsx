import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { sellerProducts, sellerViewSources } from "@/lib/db";
import { srcLabel } from "@/lib/format";

async function ViewsScreen() {
  const user = await requireSeller();
  const products = sellerProducts(user.id);
  const sources = sellerViewSources(user.id);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Views</h1>
      {products.every((product) => product.viewCount === 0) ? (
        <EmptyRecords message="No view record" />
      ) : (
        <ul className="mt-8 space-y-3">
          {products.map((product) => {
            const rows = sources.get(product.id) ?? [];
            const top = rows[0]?.count ?? 1;
            return (
              <li key={product.id} className="rounded-3xl border border-line bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-serif text-2xl">{product.title}</h2>
                  <p className="text-sm text-muted">{product.viewCount} {product.viewCount === 1 ? "view" : "views"}</p>
                </div>
                {rows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No view record</p>
                ) : (
                  <ul className="mt-3 max-w-md space-y-2">
                    {rows.map((source) => (
                      <li key={source.src}>
                        <div className="flex justify-between text-sm">
                          <span>{srcLabel(source.src)}</span>
                          <span className="text-muted">{source.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-paper-deep">
                          <div className="h-2 rounded-full bg-forest" style={{ width: `${Math.max(8, (source.count / top) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function EmptyRecords({ message }: { message: string }) {
  return (
    <div className="mt-8">
      <p className="text-sm text-muted">{message}</p>
      <Link href="/start" className="mt-6 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
        Create Twig +
      </Link>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading views…</p>}>
      <ViewsScreen />
    </Suspense>
  );
}

export const metadata = { title: "Views", robots: { index: false, follow: false } };
