import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

const LINKS = [
  ["Users", "/admin/users"],
  ["Twigs", "/admin/twigs"],
  ["Interactions", "/admin/interactions"],
  ["Reviews", "/admin/reviews"],
  ["Payments", "/admin/payments"],
  ["Payouts", "/admin/payouts"],
  ["Disputes", "/admin/disputes"],
  ["Reports", "/admin/reports"],
  ["Sellers", "/admin/sellers"],
];

async function Header() {
  await requireAdmin();
  return (
    <header className="mx-auto w-full max-w-5xl px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-forest">Seller dashboard</Link>
          <form action={signOut}>
            <button className="text-muted">Sign out</button>
          </form>
        </div>
      </div>
      <nav className="mt-4 flex flex-wrap gap-2">
        {LINKS.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-full border border-line bg-card px-4 py-2 text-sm">
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Suspense fallback={<div className="h-24" />}>
        <Header />
      </Suspense>
      <div className="mx-auto w-full max-w-5xl px-5">
        <BackButton />
      </div>
      {children}
    </div>
  );
}

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
