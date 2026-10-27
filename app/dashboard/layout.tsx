import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

async function Header() {
  const user = await requireSeller();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
      <Logo />
      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
        <Link href="/dashboard" className="text-ink">Twigs</Link>
        <Link href="/orders" className="text-ink">Orders</Link>
        <Link href="/saved" className="text-ink">Saved</Link>
        <Link href="/history" className="text-ink">History</Link>
        <Link href="/reviews" className="text-ink">Reviews</Link>
        {user.role === "admin" ? <Link href="/admin/users" className="text-ink">Admin</Link> : null}
        <form action={signOut}>
          <button className="text-muted">Sign out</button>
        </form>
      </nav>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
      </Suspense>
      <div className="mx-auto w-full max-w-5xl px-5 pt-1">
        <BackButton />
      </div>
      {children}
    </div>
  );
}

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
