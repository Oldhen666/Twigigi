import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-card">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M5 19c8-1 12-8 13-14-6 1-13 5-13 14Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.5 14.5c2-1.2 3.8-3.2 5-5.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
      <span className="font-serif text-xl tracking-tight">Twigigi</span>
    </Link>
  );
}
