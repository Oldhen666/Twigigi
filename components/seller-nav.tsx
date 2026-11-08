"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/dashboard", "Overview"],
  ["/dashboard/orders", "Orders"],
  ["/dashboard/quotes", "Quotes"],
  ["/dashboard/twigs", "Twigs"],
  ["/dashboard/payments", "Payments"],
  ["/dashboard/settings", "Settings"],
];

export function SellerNav({ attention = 0 }: { attention?: number }) {
  const path = usePathname();
  return (
    <nav className="mt-4 flex gap-4 overflow-x-auto border-b border-line text-sm">
      {LINKS.map(([href, label]) => {
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
    </nav>
  );
}
