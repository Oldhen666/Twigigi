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
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const fade = window.setTimeout(() => setVisible(false), 1100);
    const next = window.setTimeout(() => {
      setIndex((current) => (current + 1) % lines.length);
      setVisible(true);
    }, 1500);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(next);
    };
  }, [index]);

  const line = lines[index];
  return (
    <div className="mt-5 h-12 max-w-md overflow-hidden">
      <p className={`font-serif text-lg leading-snug text-ink transition duration-300 sm:text-xl ${visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}>
        {line.lead}
        <span className="mx-2 text-muted">→</span>
        <span className="text-forest italic">{line.tail}</span>
      </p>
    </div>
  );
}
