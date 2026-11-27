import Link from "next/link";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export function accountLinkClass(active: boolean) {
  return `relative inline-flex after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 ${active ? "font-medium text-forest after:bg-forest" : "text-ink after:bg-transparent hover:text-forest"}`;
}

export async function AccountNav({ current }: { current: "seller" | "buyer" }) {
  const user = await requireUser();
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm">
      <Link href="/dashboard" className={accountLinkClass(current === "seller")}>
        Selling
      </Link>
      <Link href="/orders" className={accountLinkClass(current === "buyer")}>
        Buying
      </Link>
      {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
      <form action={signOut}>
        <button className="text-muted">Sign out</button>
      </form>
    </nav>
  );
}
