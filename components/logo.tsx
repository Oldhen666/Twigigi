import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-serif text-xl leading-none tracking-tight text-ink">
      <Image src="/logo.png" alt="" width={566} height={658} className="h-[1em] w-auto" />
      <span>Twigigi</span>
    </Link>
  );
}
