"use client";

import { useEffect } from "react";

export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    const key = `twg-view-${productId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const src = new URLSearchParams(window.location.search).get("src") ?? "";
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, src, referrer: document.referrer }),
    });
  }, [productId]);

  return null;
}
