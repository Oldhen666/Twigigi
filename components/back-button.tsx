"use client";

import { usePathname, useRouter } from "next/navigation";

function fallbackFor(path: string) {
  if (path.startsWith("/admin/payments/")) return "/admin/payments";
  if (path.startsWith("/admin")) return "/dashboard";
  if (path.startsWith("/dashboard/")) return "/dashboard";
  if (path === "/login" || path === "/signup" || path === "/start" || path === "/new") return "/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 3) return `/${parts[0]}/${parts[1]}`;
  if (parts.length === 2) return `/${parts[0]}`;
  return "/";
}

export function BackButton() {
  const router = useRouter();
  const path = usePathname() || "/";
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackFor(path));
      }}
      className="self-start text-left text-sm text-muted"
    >
      ← Back
    </button>
  );
}
