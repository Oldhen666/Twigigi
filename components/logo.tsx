import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink">
      <Image src="/logo.png" alt="" width={566} height={658} className="h-9 w-auto" />
      <span className="font-serif text-xl tracking-tight">Twigigi</span>
    </Link>
  );
}
