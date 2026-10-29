"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Stars } from "@/components/stars";

export type HomeSlide = {
  href: string;
  image: string;
  title: string;
  location: string;
  price: string;
  seller: string;
  ratingAverage: number | null;
  ratingCount: number;
  cta: string;
  linkLabel: string;
  shareHref: string;
  qr: string;
};

function CardFace({ slide }: { slide: HomeSlide }) {
  return (
    <>
      <div className="relative aspect-[4/3] bg-paper-deep">
        <Image src={slide.image} alt="" fill sizes="(min-width: 1024px) 440px, 100vw" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">{slide.location}</p>
        <h2 className="mt-1 font-serif text-3xl leading-tight">{slide.title}</h2>
        <p className="mt-1 font-serif text-2xl text-forest">{slide.price}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{slide.seller}</span>
          {slide.ratingAverage != null && slide.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-forest">
              <Stars value={slide.ratingAverage} />
              <span className="font-medium text-ink">
                {slide.ratingAverage.toFixed(1)} ({slide.ratingCount})
              </span>
            </span>
          ) : null}
        </p>
        <span className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-forest text-card">{slide.cta}</span>
      </div>
    </>
  );
}

function Glyph({ kind }: { kind: "instagram" | "facebook" | "whatsapp" | "mail" | "qr" | "link" | "copy" | "chevron" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true as const, fill: "currentColor" };
  if (kind === "instagram") {
    return (
      <svg {...common}>
        <path d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5Zm8 1.8H8A2.7 2.7 0 0 0 5.3 8v8A2.7 2.7 0 0 0 8 18.7h8a2.7 2.7 0 0 0 2.7-2.7V8A2.7 2.7 0 0 0 16 5.3ZM12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2Zm0 1.7A2.1 2.1 0 1 0 14.1 12 2.1 2.1 0 0 0 12 9.9Zm4.15-2.55a.95.95 0 1 1-.95.95.95.95 0 0 1 .95-.95Z" />
      </svg>
    );
  }
  if (kind === "facebook") {
    return (
      <svg {...common}>
        <path d="M14.2 20.5v-6.7h2.2l.3-2.5h-2.5V9.7c0-.7.2-1.2 1.3-1.2h1.3V6.2c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.9H9.2v2.5h2.5v6.7Z" />
      </svg>
    );
  }
  if (kind === "whatsapp") {
    return (
      <svg {...common}>
        <path d="M12 3.6a8.2 8.2 0 0 0-7.1 12.2L3.6 20.4l4.7-1.2A8.2 8.2 0 1 0 12 3.6Zm4.7 11.6c-.2.6-1.2 1.1-1.6 1.1-.4.1-.9.2-3-.7-2.5-1.1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2 .6-.3.8-.3h.6c.2 0 .4 0 .6.5.2.6.8 2 .8 2.1.1.1 0 .3-.1.5l-.4.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 2 1.1 2.3 1.3.2.1.4.1.6-.1l.5-.6c.2-.2.3-.2.6-.1.2.1 1.6.8 1.9.9.3.2.4.2.5.3.1.2 0 .7-.2 1.3Z" />
      </svg>
    );
  }
  if (kind === "mail") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m4.5 7 7.5 6L19.5 7" />
      </svg>
    );
  }
  if (kind === "qr") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5M18.5 14H21v2.5M14 18.5V21h2.5M18.5 18.5H21V21h-2.5" />
      </svg>
    );
  }
  if (kind === "link") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M10 13a5 5 0 0 0 7.5.5l1.5-1.5a5 5 0 0 0-7-7L10.5 6.5" />
        <path d="M14 11a5 5 0 0 0-7.5-.5L5 12.5a5 5 0 0 0 7 7l1.5-1.5" />
      </svg>
    );
  }
  if (kind === "copy") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function HomeDemo({ slides }: { slides: HomeSlide[] }) {
  const [front, setFront] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const slide = slides[front] ?? slides[0];
  const behind = slides[(front + 1) % slides.length];
  if (!slide) return null;

  function step(next: 1 | -1) {
    setDirection(next);
    setQrOpen(false);
    setCopied(false);
    setFront((current) => (current + next + slides.length) % slides.length);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(slide.shareHref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const text = `${slide.title} — ${slide.shareHref}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(slide.shareHref)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mail = `mailto:?subject=${encodeURIComponent(slide.title)}&body=${encodeURIComponent(text)}`;

  return (
    <div className="relative z-0 mx-auto w-full max-w-[460px] px-3 pt-6 pb-8 sm:px-4">
      <div className="pointer-events-none absolute top-4 -right-10 h-[740px] w-80 rounded-[999px] bg-[#d7ebdd]" />
      <div className="pointer-events-none absolute top-16 -left-8 size-48 rounded-full bg-[#e7f4ea] blur-2xl" />
      <div className="pointer-events-none absolute right-2 bottom-0 h-52 w-44 rounded-full bg-[#cfe6d6]/90 blur-xl" />

      <div className="relative mt-10 pr-5 pt-4">
        {behind ? (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={`Show ${behind.title}`}
            className="absolute -top-3 right-0 block w-[78%] overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_18px_40px_rgba(70,48,16,0.08)]"
          >
            <span className="relative block aspect-[4/3] bg-paper-deep">
              <Image src={behind.image} alt="" fill sizes="320px" className="object-cover" />
            </span>
          </button>
        ) : null}
        <div key={`${front}-${direction}`} className={`relative z-10 w-[94%] ${direction > 0 ? "home-flip-next" : "home-flip-prev"}`}>
          <Link href={slide.href} className="flex flex-col overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_22px_50px_rgba(70,48,16,0.14)]">
            <CardFace slide={slide} />
          </Link>
        </div>
        <button type="button" aria-label="Previous Twig" onClick={() => step(-1)} className="absolute top-1/3 -left-1 z-20 grid size-10 place-items-center rounded-full border border-line bg-card text-forest shadow-md">
          <Glyph kind="chevron" />
        </button>
        <button type="button" aria-label="Next Twig" onClick={() => step(1)} className="absolute top-1/3 -right-1 z-20 grid size-10 place-items-center rounded-full border border-line bg-card text-forest shadow-md">
          <span className="inline-block rotate-180">
            <Glyph kind="chevron" />
          </span>
        </button>
      </div>

      <div className="relative z-10 mt-5 ml-auto flex w-[18.5rem] max-w-full -translate-y-2 flex-col items-end">
        <p className="mb-3 origin-right -rotate-6 text-right font-serif text-xl leading-tight text-forest italic">
          Share the link
          <br />
          anywhere
        </p>
        <div className="flex w-full -rotate-2 items-center gap-2 rounded-full border border-white/80 bg-card px-3.5 py-2.5 shadow-[0_16px_40px_rgba(70,48,16,0.12)]">
          <span className="text-forest">
            <Glyph kind="link" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{slide.linkLabel}</span>
          <button type="button" onClick={copyLink} aria-label={copied ? "Copied" : "Copy link"} className="text-muted">
            <Glyph kind="copy" />
          </button>
        </div>
        <div className="relative z-10 mt-[-0.65rem] mr-1 flex rotate-[2.5deg] items-center gap-2 rounded-[22px] border border-white/80 bg-card px-3 py-2 shadow-[0_18px_40px_rgba(70,48,16,0.14)]">
          <button type="button" aria-label="Copy link for Instagram" onClick={copyLink} className="grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#f9ce34,#ee2a7b_55%,#6228d7)] text-white">
            <Glyph kind="instagram" />
          </button>
          <a href={facebook} target="_blank" rel="noreferrer" aria-label="Share on Facebook" className="grid size-9 place-items-center rounded-full bg-[#1877f2] text-white">
            <Glyph kind="facebook" />
          </a>
          <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" className="grid size-9 place-items-center rounded-full bg-[#25d366] text-white">
            <Glyph kind="whatsapp" />
          </a>
          <a href={mail} aria-label="Share by email" className="grid size-9 place-items-center rounded-full bg-[#e8e4dc] text-ink">
            <Glyph kind="mail" />
          </a>
          <button type="button" aria-label="Show QR code" aria-expanded={qrOpen} onClick={() => setQrOpen((open) => !open)} className="grid size-9 place-items-center rounded-full bg-paper-deep text-forest">
            <Glyph kind="qr" />
          </button>
          {qrOpen ? (
            <div className="absolute right-0 bottom-14 rounded-2xl border border-line bg-card p-3 shadow-lg">
              <div className="qr" dangerouslySetInnerHTML={{ __html: slide.qr }} />
            </div>
          ) : null}
        </div>
        {copied ? <p className="mt-2 text-right text-xs text-forest">Copied</p> : null}
      </div>
    </div>
  );
}
