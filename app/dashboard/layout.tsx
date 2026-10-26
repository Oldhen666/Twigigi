import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

async function Header() {
  const user = await requireUser();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
      <Logo />
      <nav className="flex items-center gap-5 text-sm whitespace-nowrap">
        <Link href="/dashboard" className="text-ink">Twigs</Link>
        {user.role === "admin" ? <Link href="/admin/payments" className="text-ink">Admin</Link> : null}
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
