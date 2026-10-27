import Link from "next/link";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export async function AccountNav({ current }: { current: "seller" | "orders" | "saved" | "history" | "reviews" }) {
  const user = await requireUser();
  const link = (href: string, label: string, active: boolean) => (
    <Link href={href} className={active ? "text-sm font-medium text-forest" : "text-sm text-ink"}>
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-start justify-end gap-x-8 gap-y-3">
      {link("/dashboard", "Your Twigs", current === "seller")}
      <div className="text-sm">
        <p className="text-muted">Other Twigs</p>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {link("/orders", "Orders", current === "orders")}
          {link("/saved", "Saved", current === "saved")}
          {link("/history", "History", current === "history")}
          {link("/reviews", "Reviews", current === "reviews")}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
        <form action={signOut}>
          <button className="text-muted">Sign out</button>
        </form>
      </div>
    </div>
  );
}
