import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

const demos = [
  {
    href: "/ava/cedar-planter",
    title: "Cedar planter box",
    location: "Edmonton, Alberta",
    price: "$128.00",
    cta: "Buy now",
    image: "/seed/cedar-1.jpg",
  },
  {
    href: "/ava/garden-bench",
    title: "Custom garden bench",
    location: "Edmonton, Alberta",
    price: "Pricing on request",
    cta: "Get a quote",
    image: "/seed/bench-1.jpg",
  },
] as const;

async function HomeAuth() {
  const user = await getCurrentUser();
  return user ? (
    <Link href="/dashboard" className="text-sm text-ink hover:text-forest">
      Your Twigs
    </Link>
  ) : (
    <Link href="/login" className="text-sm text-ink hover:text-forest">
      Sign in
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end px-5 py-5 sm:px-8">
        <Suspense fallback={<span className="text-sm text-transparent">Sign in</span>}>
          <HomeAuth />
        </Suspense>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pb-16">
        <h1 className="text-center font-serif text-6xl leading-[0.92] tracking-tight sm:text-8xl">
          One Product
          <br />
          One Link
        </h1>
        <p className="mt-4 text-center text-base text-muted sm:mt-5 sm:text-lg">
          Twig any product or service into a shareable sales page in minutes.
        </p>

        <div className="mx-auto mt-12 grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-stretch gap-3 sm:mt-16 sm:gap-5">
          <section aria-label="Demo" className="rounded-[32px] bg-paper-deep p-3 sm:p-4">
            <h2 className="px-1 pb-3 text-xs tracking-[0.18em] text-muted uppercase sm:px-2 sm:text-sm">Demo</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {demos.map((demo) => (
                <Link
                  key={demo.href}
                  href={demo.href}
                  className="flex flex-col overflow-hidden rounded-[28px] bg-card shadow-[0_18px_50px_rgba(70,48,16,0.12)] transition hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[4/3] bg-paper">
                    <Image src={demo.image} alt="" fill sizes="(min-width: 1024px) 280px, 30vw" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col px-3 pt-3 pb-3 sm:px-4 sm:pt-4 sm:pb-4">
                    <p className="truncate text-[10px] tracking-[0.14em] text-muted uppercase">{demo.location}</p>
                    <h3 className="mt-1 font-serif text-base leading-tight sm:text-2xl">{demo.title}</h3>
                    <p className="mt-1 font-serif text-sm text-forest sm:text-lg">{demo.price}</p>
                    <span className="mt-auto flex h-9 items-center justify-center rounded-xl bg-forest px-2 text-xs whitespace-nowrap text-card sm:mt-4 sm:h-11 sm:text-sm">
                      {demo.cta}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <Link
            href="/start"
            className="flex flex-col items-center justify-center gap-1 rounded-[32px] bg-forest px-3 text-center text-card transition hover:bg-forest-2"
          >
            <span className="font-serif text-sm underline decoration-1 underline-offset-4 sm:text-2xl sm:decoration-2 sm:underline-offset-[6px]">
              Create
            </span>
            <span className="font-serif text-3xl leading-none sm:text-6xl">Twig it</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
