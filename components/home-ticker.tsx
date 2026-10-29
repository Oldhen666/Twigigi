"use client";

import { useEffect, useState } from "react";

const groups = [
  [
    ["Sell a used table", "Twig it"],
    ["Build a deck", "Twig it"],
    ["Offer photography services", "Twig it"],
    ["Sell a custom planter", "Twig it"],
    ["Offer home cleaning", "Twig it"],
    ["Offer tutoring", "Twig it"],
    ["Sell handmade goods", "Twig it"],
  ],
  [
    ["Selling in a Facebook Group?", "Share a Twig"],
    ["Selling through Instagram?", "Share a Twig"],
    ["Selling through WhatsApp?", "Share a Twig"],
    ["Selling in person?", "Share a Twig QR code"],
  ],
] as const;

const lines = groups.flatMap((group) => group.map((line) => ({ lead: line[0], tail: line[1] })));

export function HomeTicker() {
  const [index, setIndex] = useState(0);
  const [fromRight, setFromRight] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const next = window.setTimeout(() => {
      setFromRight((current) => !current);
      setIndex((current) => (current + 1) % lines.length);
    }, 3000);
    return () => window.clearTimeout(next);
  }, [index]);

  const line = lines[index];
  return (
    <div className="mt-5 h-8 max-w-md overflow-hidden">
      <p key={index} className={`font-serif text-lg leading-none text-ink sm:text-xl ${fromRight ? "home-ticker-right" : "home-ticker-left"}`}>
        {line.lead}
        <span className="mx-2 text-muted">→</span>
        <span className="text-forest italic">{line.tail}</span>
      </p>
    </div>
  );
}
