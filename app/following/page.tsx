import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BuyerFollowing } from "@/components/buyer-following";
import { requireUser } from "@/lib/auth";
import { listFollowing } from "@/lib/db";

async function FollowingScreen() {
  const user = await requireUser();
  return (
    <AccountFrame title="Following">
      <BuyerFollowing sellers={listFollowing(user.id)} />
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
