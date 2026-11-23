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
    href: "/ava/custom-t-shirt",
    slug: "custom-t-shirt",
    title: "Custom T-shirt",
    location: "Edmonton, Alberta",
    price: "$42.00",
    cta: "Buy now",
    image: "/seed/tee-1.jpg",
    seller: "Ava Chen",
  },
  {
    href: "/ava/office-desk",
    slug: "office-desk",
    title: "Office desk",
    location: "Edmonton, Alberta",
    price: "$180.00",
    cta: "Buy now",
    image: "/seed/desk-1.jpg",
    seller: "Ava Chen",
  },
  {
    href: "/ava/garden-bed-plan",
    slug: "garden-bed-plan",
    title: "Garden bed plan",
    location: "Digital file",
    price: "$12.00",
    cta: "Get the file",
    image: "/seed/consult-1.jpg",
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
    location: product.location || (product.cta === "file" ? "Digital file" : ""),
    price: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
    seller,
    ratingAverage,
    ratingCount,
    cta: product.buttonLabel || ctaCopy(product.cta).label,
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
  const demos = (seller?.products ?? []).filter((product) => product.demo);
  const ordered = [
    ...fallbacks.map((item) => demos.find((product) => product.slug === item.slug) ?? item),
    ...demos.filter((product) => !fallbacks.some((item) => item.slug === product.slug)),
  ];
  const slides = await Promise.all(ordered.map((item) => withQr(
    "slug" in item && !("userId" in item)
      ? {
          ...item,
          ratingAverage,
          ratingCount,
          linkLabel: `${appUrl().replace(/^https?:\/\//, "")}${item.href}`,
          shareHref: `${appUrl()}${item.href}`,
        }
      : cardFromProduct(item, seller?.displayName || "Ava Chen", ratingAverage, ratingCount),
  )));

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
          <HomeDemo slides={slides} />
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
              <h3 className="mt-2 font-serif text-2xl">Take orders for pickup or shipping</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Share a product link so customers can choose options like size or colour, add personalization details, and select pickup or shipping based on what you offer.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end pt-5">
                <Link href={createHref("buy", Boolean(user))} className={`${buttonClass} w-full`}>Create a buy now twig</Link>
              </div>
            </article>
            <article className="flex h-full flex-col rounded-[28px] border border-line bg-moss/70 p-5">
              <p className="text-sm font-medium text-forest">Instagram & TikTok online sellers</p>
              <h3 className="mt-2 font-serif text-2xl">Give followers a direct way to buy</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Share a link in your bio or DMs. Followers can order products or get digital downloads, from handmade goods to templates and guides.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end gap-2 pt-5">
                <Link href={createHref("buy", Boolean(user))} className={`${ghostClass} w-full`}>Sell a product</Link>
                <Link href={createHref("file", Boolean(user))} className={`${ghostClass} w-full`}>Sell a digital file</Link>
              </div>
            </article>
            <article className="flex h-full flex-col rounded-[28px] border border-line bg-card p-5">
              <p className="text-sm font-medium text-forest">Local contractors & service businesses</p>
              <h3 className="mt-2 font-serif text-2xl">Customer get your quotation in one step</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Share a business profile link, gathering the info that you preset to give quotation.</p>
              <div className="mt-auto flex min-h-28 flex-col justify-end pt-5">
                <Link href={createHref("quote", Boolean(user))} className={`${buttonClass} w-full`}>Create a quote listing</Link>
              </div>
            </article>
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-[28px] border border-line bg-moss px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-forest">Pricing &amp; Plans</p>
              <p className="mt-1 text-sm leading-6 text-forest">Find the right plan for the way you sell.</p>
            </div>
            <Link href="/pricing" className="inline-flex h-12 w-full shrink-0 items-center justify-center rounded-full border border-forest px-5 text-base font-medium text-forest transition hover:bg-forest/5 md:w-auto">View pricing →</Link>
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
