"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/dashboard", "Overview"],
  ["/dashboard/orders", "Orders"],
  ["/dashboard/quotes", "Quotes"],
  ["/dashboard/twigs", "Twigs"],
  ["/dashboard/payments", "Payments"],
];

export function SellerNav({ attention = 0, profileHref }: { attention?: number; profileHref: string }) {
  const path = usePathname();
  return (
    <nav className="mt-4 flex items-end gap-4 border-b border-line text-sm">
      <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto">
        {[...LINKS, [profileHref, "Public profile"]].map(([href, label]) => {
          const current = href === "/dashboard"
            ? path === "/dashboard"
            : href === "/dashboard/twigs"
              ? path.startsWith("/dashboard/twigs") || path.startsWith("/dashboard/products")
              : path === href || path.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={`shrink-0 border-b-2 pb-2 ${current ? "border-forest font-medium text-forest" : "border-transparent text-muted"}`}>
              {label}
              {href === "/dashboard/orders" && attention > 0 ? <span className="ml-1 rounded-full bg-clay/15 px-1.5 text-xs text-clay">{attention}</span> : null}
            </Link>
          );
        })}
      </div>
      <Link href="/start" className="mb-2 inline-flex h-9 shrink-0 items-center rounded-full bg-forest px-4 text-sm font-medium text-card">+ New Twig</Link>
    </nav>
  );
}
