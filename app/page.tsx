import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { BuyerMenu } from "@/components/buyer-menu";
import { HomeDemo, type HomeSlide } from "@/components/home-demo";
import { HomeTicker } from "@/components/home-ticker";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSeller } from "@/lib/catalog";
import { appUrl, ctaCopy, formatMoney } from "@/lib/format";
import type { PublicProduct } from "@/lib/types";

const createClass =
  "inline-flex h-10 items-center justify-center rounded-full bg-forest px-4 text-sm font-medium text-card transition hover:bg-forest-2";

const fallbacks = [
  {
    href: "/ava/cedar-planter",
    slug: "cedar-planter",
    title: "Cedar planter box",
    location: "Edmonton, Alberta",
    price: "$128.00",
    cta: "Buy now",
    image: "/seed/cedar-1.jpg",
    seller: "Ava Chen",
  },
  {
    href: "/ava/garden-bench",
    slug: "garden-bench",
    title: "Custom garden bench",
    location: "Edmonton, Alberta",
    price: "Pricing on request",
    cta: "Get a quote",
    image: "/seed/bench-1.jpg",
    seller: "Ava Chen",
  },
] as const;

function StepIcon({ kind }: { kind: "create" | "share" | "sell" }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (kind === "create") {
    return (
      <svg {...common}>
        <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
        <path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h4.5" />
      </svg>
    );
  }
  if (kind === "share") {
    return (
      <svg {...common}>
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="17" cy="6.5" r="2.2" />
        <circle cx="17" cy="17.5" r="2.2" />
        <path d="M8 11.1 14.8 7.6M8.1 13l6.7 3.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 7h12l-1 12H7L6 7Z" />
      <path d="M9 7V5.5A3 3 0 0 1 12 2.5 3 3 0 0 1 15 5.5V7" />
    </svg>
  );
}

function TrustIcon({ kind }: { kind: "page" | "reviews" | "lock" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (kind === "page") {
    return (
      <svg {...common}>
        <path d="M8 10h8M8 14h5" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    );
  }
  if (kind === "reviews") {
    return (
      <svg {...common}>
        <path d="m12 3.5 2.2 4.6 5 .5-3.8 3.3 1.1 4.9L12 14.6 7.5 16.8l1.1-4.9L4.8 8.6l5-.5L12 3.5Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="5" y="10" width="14" height="9" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

function cardFromProduct(product: PublicProduct, seller: string, ratingAverage: number | null, ratingCount: number) {
  const href = `/${product.username}/${product.slug}`;
  return {
    href,
    image: product.images[0] || "/seed/cedar-1.jpg",
    title: product.title,
    location: product.location,
    price: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
    seller,
    ratingAverage,
    ratingCount,
    cta: product.cta === "buy" && product.buttonLabel ? product.buttonLabel : ctaCopy(product.cta).label,
    linkLabel: `${appUrl().replace(/^https?:\/\//, "")}${href}`,
    shareHref: `${appUrl()}${href}`,
  };
}

async function withQr(slide: Omit<HomeSlide, "qr">): Promise<HomeSlide> {
  const qr = (
    await QRCode.toString(slide.shareHref, {
      type: "svg",
      margin: 1,
      color: { dark: "#1b4332", light: "#fffdf8" },
    })
  ).replace(/<\?xml.*?\?>/, "");
  return { ...slide, qr };
}

async function HomeScreen() {
  const user = await getCurrentUser();
  const seller = await getPublicSeller("ava");
  const ratingAverage = seller?.ratingAverage ?? null;
  const ratingCount = seller?.ratingCount ?? 0;
  const live = (slug: string) => seller?.products.find((product) => product.slug === slug) ?? null;
  const cedarProduct = live("cedar-planter");
  const benchProduct = live("garden-bench");
  const cedar = await withQr(
    cedarProduct
      ? cardFromProduct(cedarProduct, seller?.displayName || "Ava Chen", ratingAverage, ratingCount)
      : {
          ...fallbacks[0],
          ratingAverage,
          ratingCount,
          linkLabel: `${appUrl().replace(/^https?:\/\//, "")}${fallbacks[0].href}`,
          shareHref: `${appUrl()}${fallbacks[0].href}`,
        },
  );
  const bench = await withQr(
    benchProduct
      ? cardFromProduct(benchProduct, seller?.displayName || "Ava Chen", ratingAverage, ratingCount)
      : {
          ...fallbacks[1],
          ratingAverage,
          ratingCount,
          linkLabel: `${appUrl().replace(/^https?:\/\//, "")}${fallbacks[1].href}`,
          shareHref: `${appUrl()}${fallbacks[1].href}`,
        },
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-[#f6f1e8]">
        <div className="page-frame flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
        <Logo />
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a href="#how" className="text-ink hover:text-forest">How it works</a>
          {user ? (
            <>
              <Link href="/dashboard" className="text-ink hover:text-forest">Selling</Link>
              <BuyerMenu active={false} />
            </>
          ) : (
            <Link href="/login" className="text-ink hover:text-forest">Sign in</Link>
          )}
          <Link href="/start" className={createClass}>Create a Twig</Link>
        </nav>
        </div>
      </header>

      <main>
        <section className="page-frame grid items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:py-14">
          <div>
            <h1 className="font-serif text-5xl tracking-tight sm:text-7xl">
              <span className="block leading-none">One product.</span>
              <span className="mt-4 block leading-none sm:mt-6">One link.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
              Create a simple page, share the link, and let buyers order or request a quote.
            </p>
            <Link href="/start" className="mt-8 inline-flex h-auto min-h-14 w-fit max-w-xl items-center rounded-full bg-forest px-6 py-3 text-lg leading-7 text-card transition hover:bg-forest-2 sm:whitespace-nowrap">
              <span className="font-bold">Create a Twig</span>
              <span className="font-normal"> page for your own Product/Service Quote</span>
            </Link>
            <HomeTicker />
          </div>
          <HomeDemo slides={[cedar, bench]} />
        </section>

        <section id="how" className="scroll-mt-24 border-t border-line/80">
          <div className="page-frame py-14">
            <h2 className="text-center font-serif text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                { kind: "create" as const, title: "1. Create", body: "Add a photo, a price or a quote form, and where you are." },
                { kind: "share" as const, title: "2. Share", body: "Send the link by text, email, or a QR code." },
                { kind: "sell" as const, title: "3. Sell", body: "Buyers order, request a quote, or write to you." },
              ].map((step) => (
                <li key={step.title} className="text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-moss text-forest">
                    <StepIcon kind={step.kind} />
                  </span>
                  <h3 className="mt-4 font-serif text-2xl">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="page-frame pb-16">
          <div className="grid gap-6 rounded-[28px] bg-moss/70 px-5 py-8 sm:grid-cols-3 sm:px-8">
            {[
              { kind: "page" as const, title: "One page", body: "The listing, orders, and quotes stay with that Twig." },
              { kind: "reviews" as const, title: "Reviews", body: "A finished order or quote can be reviewed. The score stays with the seller." },
              { kind: "lock" as const, title: "Your details", body: "You choose the contact and how buyers pay you." },
            ].map((item) => (
              <div key={item.title}>
                <span className="grid size-10 place-items-center rounded-full bg-card text-forest">
                  <TrustIcon kind={item.kind} />
                </span>
                <h3 className="mt-3 font-serif text-xl">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<p className="page-frame py-8 text-muted">Loading…</p>}>
        <HomeScreen />
      </Suspense>
    </div>
  );
}
