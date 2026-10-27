import Link from "next/link";
import { AccountNav } from "@/components/account-nav";
import { Logo } from "@/components/logo";

const BUYER_LINKS = [
  ["Orders", "/orders", "orders"],
  ["Saved", "/saved", "saved"],
  ["History", "/history", "history"],
  ["Reviews", "/reviews", "reviews"],
] as const;

export async function AccountFrame({
  title,
  lede,
  section,
  children,
}: {
  title: string;
  lede?: string;
  section: "orders" | "saved" | "history" | "reviews";
  children: React.ReactNode;
}) {
  return (
    <div className="buyer-theme min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <AccountNav current="buyer" />
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <p className="text-sm text-muted">Other Twigs</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {BUYER_LINKS.map(([label, href, id]) => (
            <Link key={id} href={href} className={id === section ? "font-medium text-forest" : "text-ink"}>
              {label}
            </Link>
          ))}
        </nav>
        <h1 className="mt-8 font-serif text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm text-muted">{lede}</p> : null}
        {children}
      </main>
    </div>
  );
}
