"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function parentFor(path: string) {
  const clean = path.split("?")[0] || "/";
  if (clean.startsWith("/admin/payments/") && clean !== "/admin/payments") return "/admin/payments";
  if (clean === "/admin" || clean.startsWith("/admin/")) return "/dashboard";
  if (/^\/dashboard\/orders\/.+/.test(clean)) return "/dashboard/orders";
  if (/^\/dashboard\/quotes\/.+/.test(clean)) return "/dashboard/quotes";
  if (clean.startsWith("/dashboard/")) return "/dashboard";
  if (clean === "/forgot" || clean === "/reset") return "/login";
  if (
    clean === "/dashboard" ||
    clean === "/orders" ||
    clean === "/saved" ||
    clean === "/history" ||
    clean === "/reviews" ||
    clean === "/login" ||
    clean === "/signup" ||
    clean === "/start" ||
    clean === "/new"
  ) {
    return "/";
  }
  const parts = clean.split("/").filter(Boolean);
  if (parts.length >= 3) return `/${parts[0]}/${parts[1]}`;
  if (parts.length === 2) return `/${parts[0]}`;
  return "/";
}

export function BackButton() {
  const path = usePathname() || "/";
  return (
    <Link href={parentFor(path)} className="self-start text-left text-sm text-muted">
      ← Back
    </Link>
  );
}
