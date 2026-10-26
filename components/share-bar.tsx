"use client";

import { useEffect, useRef, useState } from "react";

export function CopyLink({
  url,
  label = "Copy link",
  className = "text-sm font-medium text-forest",
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={copied ? "inline-flex h-9 shrink-0 items-center rounded-full bg-forest px-3 text-sm text-card" : className}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function svgToPng(svg: string, size: number) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is unavailable"));
        return;
      }
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, size, size);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
    };
    image.onerror = () => reject(new Error("QR image failed to load"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function UiIcon({ id }: { id: "link" | "qr" | "plane" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (id === "link") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.5.5l1.5-1.5a5 5 0 0 0-7-7L10.5 6.5" />
        <path d="M14 11a5 5 0 0 0-7.5-.5L5 12.5a5 5 0 0 0 7 7l1.5-1.5" />
      </svg>
    );
  }
  if (id === "qr") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <path d="M14 14h2.5v2.5H14zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M21 4 3.5 10.5l7 2.2 2.2 7z" />
      <path d="M10.5 12.7 21 4" />
    </svg>
  );
}

const MARK = 28;

const BRANDS = {
  facebook: { src: "/brands/facebook.png" },
  whatsapp: { src: "/brands/whatsapp.svg" },
  x: { src: "/brands/x.png" },
  reddit: { src: "/brands/reddit.png" },
  pinterest: { src: "/brands/pinterest.jpg", scale: 520 / 165 },
  threads: { src: "/brands/threads.svg" },
} as const;

function BrandMark({ id }: { id: keyof typeof BRANDS }) {
  const brand = BRANDS[id];
  const scale = "scale" in brand ? brand.scale : 1;
  return (
    <span className="relative size-7 overflow-hidden">
      <img
        src={brand.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        style={{ height: MARK * scale, width: scale === 1 ? MARK : "auto" }}
      />
    </span>
  );
}

function ActionIcon({ id }: { id: "sms" | "email" }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  if (id === "sms") {
    return (
      <svg {...common}>
        <path d="M5 6.5h14a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 3.2V16H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

const CHANNELS = [
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "x", label: "X" },
  { id: "reddit", label: "Reddit" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
] as const;

const actionClass = "flex h-10 w-full items-center gap-2.5 rounded-full border border-line bg-card px-3.5 text-sm";
const copiedClass = "flex h-10 w-full items-center gap-2.5 rounded-full bg-forest px-3.5 text-sm text-card";

export function ShareBar({ url, title, image, qr }: { url: string; title: string; image?: string; qr: string }) {
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!popover.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function tracked(src: string) {
    const next = new URL(url);
    next.searchParams.set("src", src);
    return next.toString();
  }

  function href(id: (typeof CHANNELS)[number]["id"]) {
    const shareUrl = tracked(id);
    const text = `${title} — ${shareUrl}`;
    if (id === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    if (id === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (id === "x") {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
    }
    if (id === "reddit") {
      return `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;
    }
    if (id === "pinterest") {
      const media = image ? `&media=${encodeURIComponent(image)}` : "";
      return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(title)}${media}`;
    }
    if (id === "threads") return `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
    if (id === "sms") return `sms:?&body=${encodeURIComponent(text)}`;
    return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      setLinkCopied(false);
    }
  }

  async function copyQr() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": svgToPng(qr, 1024) })]);
      setQrCopied(true);
      window.setTimeout(() => setQrCopied(false), 1600);
    } catch {
      setQrCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="qr shrink-0 rounded-xl border border-line bg-card p-2" role="img" aria-label="QR code" dangerouslySetInnerHTML={{ __html: qr }} />
      <div ref={popover} className="relative flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
          className={actionClass}
        >
          <UiIcon id="plane" />
          <span>Share</span>
        </button>
        <button type="button" onClick={copyQr} aria-live="polite" aria-label={qrCopied ? "QR code copied" : "Copy QR"} className={qrCopied ? copiedClass : actionClass}>
          <UiIcon id="qr" />
          <span>{qrCopied ? "Copied ✓" : "Copy QR"}</span>
        </button>
        <button type="button" onClick={copyLink} aria-live="polite" aria-label={linkCopied ? "Link copied" : "Copy link"} className={linkCopied ? copiedClass : actionClass}>
          <UiIcon id="link" />
          <span>{linkCopied ? "Copied ✓" : "Copy link"}</span>
        </button>
        {open ? (
          <div role="dialog" aria-label="Share" className="absolute top-12 right-0 z-20 grid w-max grid-cols-4 gap-2 rounded-2xl border border-line bg-card p-3 shadow-[0_18px_50px_rgba(70,48,16,0.16)]">
            {CHANNELS.map((channel) => (
              <a
                key={channel.id}
                href={href(channel.id)}
                aria-label={channel.label}
                title={channel.label}
                target={channel.id === "sms" || channel.id === "email" ? undefined : "_blank"}
                rel="noreferrer"
                className="grid size-11 place-items-center rounded-xl border border-line text-ink"
              >
                {channel.id === "sms" || channel.id === "email" ? (
                  <ActionIcon id={channel.id} />
                ) : (
                  <BrandMark id={channel.id} />
                )}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
