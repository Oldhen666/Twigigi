import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { requireUser } from "@/lib/auth";
import { listBrowseHistory } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

async function HistoryScreen() {
  const user = await requireUser();
  const history = listBrowseHistory(user.id);
  return (
    <AccountFrame title="Browse history" lede="Twigs you opened while signed in.">
      {history.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Twigs you open will show up here.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {history.map(({ product, seenAt }) => (
            <li key={product.id}>
              <Link href={`/${product.username}/${product.slug}`} className="flex gap-4 rounded-2xl border border-line bg-card p-4">
                <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                  {product.images[0] ? <Image src={product.images[0]} alt="" fill className="object-cover" sizes="80px" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-2xl">{product.title}</span>
                  <span className="block text-sm text-muted">{product.displayName}</span>
                  <span className="mt-1 block">{product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}</span>
                  <span className="block text-sm text-muted">{formatDate(seenAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading history…</p>}>
      <HistoryScreen />
    </Suspense>
  );
}

export const metadata = { title: "Browse history", robots: { index: false, follow: false } };
