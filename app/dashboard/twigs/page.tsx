import Link from "next/link";
import { Suspense } from "react";
import { TwigCard } from "@/components/twig-card";
import { TwigSelectAll, TwigSelectionProvider } from "@/components/twig-selection";
import { getImpersonation, requireSeller } from "@/lib/auth";
import { productHasActivity, sellerProducts } from "@/lib/db";
import { isTwigLive } from "@/lib/format";

async function TwigsScreen() {
  const user = await requireSeller();
  const acting = Boolean(await getImpersonation());
  const products = sellerProducts(user.id);
  const live = products.filter((product) => isTwigLive(product)).length;
  const drafts = products.filter((product) => product.status === "draft").length;
  const picks = products.map((product) => ({
    id: product.id,
    title: product.title,
    status: product.status,
    canDelete: product.status === "deactivated" || (product.status === "draft" && !productHasActivity(product.id)),
  }));

  return (
    <main className="page-frame pb-16">
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">Twigs</h1>
          <p className="mt-2 text-sm text-muted">{live} live · {drafts} {drafts === 1 ? "draft" : "drafts"}</p>
        </div>
        <Link href="/start" className="inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-medium text-card">+ New Twig</Link>
      </div>
      {products.length === 0 ? (
        <div className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-2xl">No Twigs yet</h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted">A Twig is the page buyers open to buy, request a quote, or get a file.</p>
          <Link href="/start" className="mt-4 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Create a Twig</Link>
        </div>
      ) : (
        <TwigSelectionProvider items={picks}>
          <div className="mt-6 flex items-center gap-3">
            <TwigSelectAll />
            <p className="text-sm text-muted">Select</p>
          </div>
          <div className="mt-3 space-y-3">
            {products.map((product) => (
              <TwigCard
                key={product.id}
                product={product}
                publicId={user.publicId}
                acting={acting}
                selectable
                canDelete={picks.find((item) => item.id === product.id)?.canDelete ?? false}
              />
            ))}
          </div>
        </TwigSelectionProvider>
      )}
    </main>
  );
}

export const metadata = { title: "Twigs", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading Twigs…</p>}>
      <TwigsScreen />
    </Suspense>
  );
}
