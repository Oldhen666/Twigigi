import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";
import { listOrders } from "@/lib/db";
import { sellerAttention } from "@/lib/order-flow";
import { AccountNav } from "@/components/account-nav";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { SellerNav } from "@/components/seller-nav";

async function Header() {
  await requireSeller();
  return (
    <header className="page-frame flex items-center justify-between gap-3 py-5">
      <Logo />
      <AccountNav current="seller" />
    </header>
  );
}

async function Sections() {
  const user = await requireSeller();
  const attention = listOrders(user.id).filter((order) => sellerAttention(order)).length;
  return <SellerNav attention={attention} />;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seller-theme min-h-screen">
      <Suspense fallback={<div className="h-16" />}>
        <Header />
      </Suspense>
      <div className="page-frame pt-2">
        <BackButton />
        <Suspense fallback={<div className="mt-4 h-8" />}>
          <Sections />
        </Suspense>
      </div>
      {children}
    </div>
  );
}

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
