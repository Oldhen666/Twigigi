import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { BuyerMenu } from "@/components/buyer-menu";
import { HomeDemo, type HomeSlide } from "@/components/home-demo";
import { HomeTicker } from "@/components/home-ticker";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSeller } from "@/lib/catalog";
import { resolveSellerRoute } from "@/lib/db";
import { buttonClass, ghostClass } from "@/components/ui";
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
    href: "/ava/landscape",
    slug: "landscape",
    title: "Landscape service",
    location: "Edmonton, Alberta",
    price: "Pricing on request",
    cta: "Get a quote",
    image: "/seed/deck-1.jpg",
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

function createHref(cta: "buy" | "file" | "quote", signedIn: boolean) {
  const editor = `/dashboard/products/new?cta=${cta}`;
  return signedIn ? editor : `/login?next=${encodeURIComponent(editor)}`;
}

function cardFromProduct(product: PublicProduct, seller: string, ratingAverage: number | null, ratingCount: number) {
  const href = `/${product.publicId}/${product.slug}`;
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
  const ava = resolveSellerRoute("ava");
  const seller = ava ? await getPublicSeller(ava.publicId) : null;
  const ratingAverage = seller?.ratingAverage ?? null;
  const ratingCount = seller?.ratingCount ?? 0;
  const live = (slug: string) => seller?.products.find((product) => product.slug === slug) ?? null;
  const cedarProduct = live("cedar-planter");
  const landscapeProduct = live("landscape") ?? live("garden-bench");
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
  const landscape = await withQr(
    landscapeProduct
      ? cardFromProduct(landscapeProduct, seller?.displayName || "Ava Chen", ratingAverage, ratingCount)
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
              {user.role === "admin" ? <Link href="/admin/users" className="text-ink hover:text-forest">Admin</Link> : null}
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
              <span className="block leading-none">One offer.</span>
              <span className="mt-4 block leading-none sm:mt-6">One link.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
              Create a page for your product or service, then share the link with your customers.
            </p>
            <Link href="/start" className="mt-8 inline-flex h-14 items-center rounded-full bg-forest px-6 text-lg font-bold text-card transition hover:bg-forest-2">
              Create a Twig
            </Link>
            <HomeTicker />
          </div>
          <HomeDemo slides={[cedar, landscape]} />
        </section>

        <section id="how" className="scroll-mt-36 border-t border-line/80">
          <div className="page-frame py-14">
            <h2 className="text-center font-serif text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                { kind: "create" as const, title: "Create your page", body: "Add photos and details. Set a price or choose what customers should include in a quote request." },
                { kind: "share" as const, title: "Share your link", body: "Send it by text or email, put it in your social bio, or share it as a QR code." },
                { kind: "sell" as const, title: "Get orders or quote requests", body: "Customers can place an order, buy a digital download, or tell you what they need for a quote." },
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
          <div className="grid items-stretch gap-4 md:grid-cols-3">
            <article className="flex h-full flex-col rounded-[28px] border border-line bg-card p-5">
              <p className="text-sm font-medium text-forest">Local shops & makers</p>
              <h3 className="mt-2 font-serif text-2xl">Take orders for local pickup</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Share a product link by text or QR code. Customers can choose their options and select pickup if you offer it.</p>
              <p className="mt-3 text-sm leading-6">A customer orders a custom cap and enters the name to embroider.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end pt-5">
                <Link href={createHref("buy", Boolean(user))} className={`${buttonClass} w-full`}>Create a product listing</Link>
              </div>
            </article>
            <article className="flex h-full flex-col rounded-[28px] border border-line bg-moss/70 p-5">
              <p className="text-sm font-medium text-forest">Instagram & TikTok sellers</p>
              <h3 className="mt-2 font-serif text-2xl">Give followers a direct way to buy</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Put a product link in your bio or send it in a DM. Sell a physical product or offer a digital download.</p>
              <p className="mt-3 text-sm leading-6">Share an STL in your bio and let buyers download it once payment is confirmed.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end gap-2 pt-5">
                <Link href={createHref("buy", Boolean(user))} className={`${ghostClass} w-full`}>Sell a product</Link>
                <Link href={createHref("file", Boolean(user))} className={`${ghostClass} w-full`}>Sell a digital file</Link>
              </div>
            </article>
            <article className="flex h-full flex-col rounded-[28px] border border-line bg-card p-5">
              <p className="text-sm font-medium text-forest">Local contractors & service businesses</p>
              <h3 className="mt-2 font-serif text-2xl">Get the details you need to quote</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Share a service link. Ask for the job details you need, such as a postal code and the scope of work.</p>
              <p className="mt-3 text-sm leading-6">A homeowner describes a two-car driveway so you can prepare a snow removal quote.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end pt-5">
                <Link href={createHref("quote", Boolean(user))} className={`${buttonClass} w-full`}>Create a quote listing</Link>
              </div>
            </article>
          </div>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm leading-6 text-muted">Start with one product or service. Share it with customers you already reach.</p>
            <Link href="/pricing" className="inline-flex h-12 items-center text-sm font-medium text-forest">See seller pricing</Link>
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
