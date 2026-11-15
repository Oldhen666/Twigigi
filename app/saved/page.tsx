import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BuyerSaved } from "@/components/buyer-saved";
import { requireUser } from "@/lib/auth";
import { listFavorites } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { storedUpload } from "@/lib/uploads";

async function SavedScreen() {
  const user = await requireUser();
  const saved = listFavorites(user.id);
  return (
    <AccountFrame title="Saved">
      <BuyerSaved
        items={saved.map((product) => ({
          id: product.id,
          title: product.title,
          seller: product.displayName,
          price: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
          priceCents: product.priceCents,
          href: `/${product.publicId}/${product.slug}`,
          image: product.images[0] ?? "",
          unoptimized: Boolean(product.images[0] && storedUpload(product.images[0])),
          savedAt: product.savedAt,
          cta: product.cta,
        }))}
      />
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading saved Twigs…</p>}>
      <SavedScreen />
    </Suspense>
  );
}

export const metadata = { title: "Saved", robots: { index: false, follow: false } };
