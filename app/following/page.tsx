import Link from "next/link";
import { Suspense } from "react";
import { toggleFollowSeller } from "@/lib/actions";
import { AccountFrame } from "@/components/account-frame";
import { BuyerSection } from "@/components/buyer-section";
import { requireUser } from "@/lib/auth";
import { listFollowing } from "@/lib/db";

async function FollowingScreen() {
  const user = await requireUser();
  const following = listFollowing(user.id);
  return (
    <AccountFrame title="Following">
      <BuyerSection title="Following" center={following.length === 0}>
        {following.length === 0 ? (
          <p className="text-sm text-muted">Sellers you follow will show up here.</p>
        ) : (
          <ul className="space-y-3">
            {following.map((seller) => (
              <li key={seller.publicId} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4">
                <Link href={`/${seller.publicId}`} className="min-w-0">
                  <span className="block font-serif text-2xl">{seller.displayName}</span>
                  <span className="block text-sm text-muted">{seller.username}</span>
                </Link>
                <form action={toggleFollowSeller}>
                  <input type="hidden" name="seller" value={seller.publicId} />
                  <input type="hidden" name="next" value="/following" />
                  <button className="text-sm text-forest">Unfollow</button>
                </form>
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
    <Suspense fallback={<p className="p-8 text-muted">Loading following…</p>}>
      <FollowingScreen />
    </Suspense>
  );
}

export const metadata = { title: "Following", robots: { index: false, follow: false } };
