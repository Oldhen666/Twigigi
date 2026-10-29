"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

function BrandMark({ name }: { name: "instagram" | "facebook" | "whatsapp" }) {
  if (name === "facebook") {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden>
        <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        <path fill="#fff" d="M16.671 15.563l.532-3.49h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.996s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.79H7.078v3.49h3.047V24a12.1 12.1 0 0 0 3.75 0v-8.437h2.796z" />
      </svg>
    );
  }
  if (name === "whatsapp") {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden>
        <path fill="#25D366" d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2z" />
        <path fill="#fff" d="M17.47 14.38c-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.12-.51.12-.15.23-.59.75-.72.9-.13.15-.27.17-.5.06-.23-.12-.97-.36-1.85-1.14-.68-.61-1.14-1.36-1.28-1.59-.13-.23-.01-.36.1-.47.1-.1.23-.27.34-.4.11-.13.15-.23.23-.38.08-.15.04-.29-.02-.4-.06-.12-.51-1.23-.7-1.68-.18-.44-.37-.38-.51-.39h-.43c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9s.82 2.2.93 2.35c.12.15 1.61 2.46 3.9 3.45.54.23 1.06.37 1.43.48.61.17 1.16.15 1.6.09.49-.06 1.36-.56 1.55-1.1.19-.53.19-.99.13-1.08-.05-.1-.2-.15-.43-.27z" />
      </svg>
    );
  }
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="ig" cx="30%" cy="110%" r="120%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig)" />
      <path fill="#fff" d="M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1Zm5-8.15a1.12 1.12 0 1 1-1.12-1.12A1.12 1.12 0 0 1 17 6.95Z" />
      <path fill="none" stroke="#fff" strokeWidth="1.4" d="M8.2 4.8h7.6A3.4 3.4 0 0 1 19.2 8.2v7.6a3.4 3.4 0 0 1-3.4 3.4H8.2a3.4 3.4 0 0 1-3.4-3.4V8.2A3.4 3.4 0 0 1 8.2 4.8Z" />
    </svg>
  );
}

function Glyph({ kind }: { kind: "mail" | "qr" | "link" | "copy" | "chevron" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true as const, fill: "currentColor" };
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

  useEffect(() => {
    if (slides.length < 2) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const timer = window.setTimeout(() => {
      setDirection(1);
      setQrOpen(false);
      setCopied(false);
      setFront((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [front, slides.length]);

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
          <button type="button" aria-label="Copy link for Instagram" onClick={copyLink} className="grid size-9 place-items-center overflow-hidden rounded-[10px]">
            <BrandMark name="instagram" />
          </button>
          <a href={facebook} target="_blank" rel="noreferrer" aria-label="Share on Facebook" className="grid size-9 place-items-center overflow-hidden rounded-full">
            <BrandMark name="facebook" />
          </a>
          <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" className="grid size-9 place-items-center overflow-hidden rounded-full">
            <BrandMark name="whatsapp" />
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
