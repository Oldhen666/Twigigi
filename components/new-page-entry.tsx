"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { markHistoryBack, noteNewVisit, notePath } from "@/lib/draft-session";

function isNewPage(path: string) {
  return path === "/dashboard/products/new";
}

export function NewPageEntry({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visit, setVisit] = useState(0);
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    notePath(pathname);
    if (isNewPage(pathname) && !isNewPage(path)) {
      noteNewVisit();
      setVisit((current) => current + 1);
    }
  }
  useEffect(() => {
    const onPop = () => markHistoryBack();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return (
    <div key={isNewPage(pathname) ? `new-${visit}` : "app"} className="contents">
      {children}
    </div>
  );
}
