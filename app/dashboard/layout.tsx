import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

async function Header() {
  await requireSeller();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
      <Logo />
      <AccountNav current="seller" />
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
      </Suspense>
      <div className="mx-auto w-full max-w-5xl px-5 pt-2">
        <BackButton />
      </div>
      {children}
    </div>
  );
}

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
