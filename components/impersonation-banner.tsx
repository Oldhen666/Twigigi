import { exitSellerAccount } from "@/lib/actions";
import { getCurrentUser, getImpersonation } from "@/lib/auth";

export async function ImpersonationBanner() {
  const admin = await getImpersonation();
  if (!admin) return null;
  const seller = await getCurrentUser();
  if (!seller) return null;
  return (
    <div className="bg-ink px-5 py-2 text-sm text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <p>You are in {seller.displayName}&apos;s account. Listing fees are skipped.</p>
        <form action={exitSellerAccount}>
          <button className="font-medium underline">Exit</button>
        </form>
      </div>
    </div>
  );
}
