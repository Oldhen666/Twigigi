import Link from "next/link";
import { BuyerMenu } from "@/components/buyer-menu";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export async function AccountNav({ current }: { current: "seller" | "buyer" }) {
  const user = await requireUser();
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm">
      <Link href="/dashboard" className={current === "seller" ? "font-medium text-forest" : "text-ink"}>
        Your Twigs
      </Link>
      <BuyerMenu active={current === "buyer"} />
      {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
      <form action={signOut}>
        <button className="text-muted">Sign out</button>
      </form>
    </nav>
  );
}
