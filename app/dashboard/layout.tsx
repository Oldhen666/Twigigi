import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

async function Header() {
  await requireSeller();
  return (
    <header className="page-frame flex items-center justify-between gap-3 py-5">
      <Logo />
      <AccountNav current="seller" />
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seller-theme min-h-screen">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
      </Suspense>
      <div className="page-frame pt-2">
        <BackButton />
      </div>
      {children}
    </div>
  );
}

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
