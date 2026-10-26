"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

function isNewPage(path: string) {
  return path === "/dashboard/products/new";
}

export function NewPageEntry({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visit, setVisit] = useState(0);
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    if (isNewPage(pathname) && !isNewPage(path)) setVisit((current) => current + 1);
  }
  return (
    <div key={isNewPage(pathname) ? `new-${visit}` : "app"} className="contents">
      {children}
    </div>
  );
}
