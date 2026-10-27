import Link from "next/link";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export async function AccountNav({ current }: { current: "seller" | "buyer" }) {
  const user = await requireUser();
  const item = (href: string, label: string, active: boolean) => (
    <Link href={href} className={active ? "font-medium text-forest" : "text-ink"}>
      {label}
    </Link>
  );
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm">
      {item("/dashboard", "Your Twigs", current === "seller")}
      {item("/orders", "Other Twigs", current === "buyer")}
      {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
      <form action={signOut}>
        <button className="text-muted">Sign out</button>
      </form>
    </nav>
  );
}
