import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { toggleSaved } from "@/lib/actions";
import { AccountFrame } from "@/components/account-frame";
import { BuyerSection } from "@/components/buyer-section";
import { requireUser } from "@/lib/auth";
import { listFavorites } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { storedUpload } from "@/lib/uploads";

async function SavedScreen() {
  const user = await requireUser();
  const saved = listFavorites(user.id);
  return (
    <AccountFrame title="Saved">
      <BuyerSection title="Saved" center={saved.length === 0}>
      {saved.length === 0 ? (
        <p className="text-sm text-muted">Save a Twig from its page. It stays here.</p>
      ) : (
        <ul className="space-y-3">
          {saved.map((product) => (
            <li key={product.id} className="flex gap-4 rounded-2xl border border-line bg-card p-4">
              <Link href={`/${product.publicId}/${product.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                {product.images[0] ? <Image src={product.images[0]} alt="" fill unoptimized={storedUpload(product.images[0])} className="object-cover" sizes="80px" /> : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/${product.publicId}/${product.slug}`} className="font-serif text-2xl">{product.title}</Link>
                <p className="text-sm text-muted">{product.displayName}</p>
                <p className="mt-1">{product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}</p>
                <form action={toggleSaved} className="mt-2">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="next" value="/saved" />
                  <button className="text-sm text-forest">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      </BuyerSection>
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
