import Link from "next/link";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export async function AccountFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
          <Link href="/dashboard" className="text-ink">Twigs</Link>
          <Link href="/orders" className="text-ink">Orders</Link>
          <Link href="/saved" className="text-ink">Saved</Link>
          <Link href="/reviews" className="text-ink">Reviews</Link>
          {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
          <form action={signOut}>
            <button className="text-muted">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="font-serif text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm text-muted">{lede}</p> : null}
        {children}
      </main>
    </div>
  );
}
