import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getPublicProduct, requireLiveTwig } from "@/lib/catalog";
import { BuyPicker } from "@/components/buy-picker";
import { CopyLink, ShareBar } from "@/components/share-bar";
import { Stage } from "@/components/stage";
import { ViewTracker } from "@/components/view-tracker";
import { Logo } from "@/components/logo";
import { BackButton } from "@/components/back-button";
import { PayMethods } from "@/components/pay-methods";
import { appUrl, ctaCopy, formatMoney, fulfillmentOptions, productUrl, videoEmbed, withSrc } from "@/lib/format";

export async function ProductView({
  params,
}: {
  params: Promise<{ username: string; product: string }>;
}) {
  const { username, product: slug } = await params;
  const product = await requireLiveTwig(await getPublicProduct(username, slug));
  if (!product) notFound();

  const canonical = productUrl(product.username, product.slug);
  const qr = (await QRCode.toString(withSrc(canonical, "qr"), {
    type: "svg",
    margin: 1,
    color: { dark: "#1b4332", light: "#fffdf8" },
  })).replace(/<\?xml.*?\?>/, "");
  const options = fulfillmentOptions(product);
  const cta = ctaCopy(product.cta);
  const buyLabel = product.cta === "buy" ? product.buttonLabel || cta.label : cta.label;
  const showOptions = product.cta === "buy" && product.hasOptions && product.options.length > 0 && product.priceCents != null;
  const soldOut = product.cta === "buy" && product.quantityAvailable === 0;
  const embed = videoEmbed(product.videoUrl);
  const image = product.images[0] ? `${appUrl()}${product.images[0]}` : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((item) => `${appUrl()}${item}`),
    url: canonical,
    brand: product.brand || product.displayName,
    offers: product.priceCents
      ? {
          "@type": "Offer",
          priceCurrency: product.currency,
          price: (product.priceCents / 100).toFixed(2),
          availability: "https://schema.org/InStock",
          url: canonical,
          areaServed: product.location,
        }
      : undefined,
  };

  return (
    <Stage>
      <div className="px-4 pt-3 sm:px-0">
        <BackButton />
      </div>
      <article className="mt-2 bg-card shadow-[0_0_70px_rgba(28,25,21,0.28),0_24px_50px_rgba(28,25,21,0.16)] sm:rounded-[28px]">
        <header className="flex items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1">
            <CopyLink url={canonical} />
            <Link href="/" aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink hover:bg-paper-deep">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Link>
          </div>
        </header>
        {product.images.length > 0 ? (
          <div className="flex snap-x snap-mandatory overflow-x-auto">
            {product.images.map((src, index) => (
              <div key={src} className="relative aspect-square w-full shrink-0 snap-center bg-paper-deep">
                <Image
                  src={src}
                  alt={`${product.title}, photo ${index + 1}`}
                  fill
                  priority={index === 0}
                  sizes="440px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
        {product.images.length > 1 ? <p className="px-5 pt-2 text-xs text-muted">Swipe for more photos</p> : null}
        <div className="px-5 pt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{product.location}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight">{product.title}</h1>
          {product.brand ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Brand</p>
              <p className="mt-1 text-sm">{product.brand}</p>
            </div>
          ) : null}
          {showOptions ? (
            <BuyPicker
              username={product.username}
              slug={product.slug}
              currency={product.currency}
              priceCents={product.priceCents ?? 0}
              buttonLabel={buyLabel}
              options={product.options}
              variants={product.variants}
              samePrice={product.samePrice}
              quantityAvailable={product.quantityAvailable}
            >
              {options.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {options.map((option) => (
                    <li key={option.id} className="rounded-full bg-moss px-3 py-1 text-sm text-forest">
                      {option.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-sm text-muted">
                Sold by{" "}
                <Link href={`/${product.username}`} className="text-ink underline-offset-2 hover:underline">
                  {product.displayName}
                </Link>
              </p>
              {product.cta === "buy" ? <PayMethods methods={product.paymentMethods} cardPaymentUrl="" /> : null}
            </BuyPicker>
          ) : (
            <>
              <p className="mt-2 font-serif text-3xl text-forest">
                {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}
              </p>
              {options.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {options.map((option) => (
                    <li key={option.id} className="rounded-full bg-moss px-3 py-1 text-sm text-forest">
                      {option.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-sm text-muted">
                Sold by{" "}
                <Link href={`/${product.username}`} className="text-ink underline-offset-2 hover:underline">
                  {product.displayName}
                </Link>
              </p>
              {product.cta === "buy" ? <PayMethods methods={product.paymentMethods} cardPaymentUrl="" /> : null}
            </>
          )}
        </div>
        {showOptions ? null : (
        <div className="sticky bottom-0 z-10 mt-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          {soldOut ? (
            <span className="flex h-14 items-center justify-center rounded-2xl bg-paper-deep text-lg text-muted">Sold out</span>
          ) : (
            <Link href={`/${product.username}/${product.slug}/${cta.href}`} className="flex h-14 items-center justify-center rounded-2xl bg-forest text-lg text-card">
              {buyLabel}
            </Link>
          )}
        </div>
        )}
        <div className="space-y-5 px-5 py-5">
          <p className="whitespace-pre-wrap text-[15px] leading-7">{product.description}</p>
          {embed ? (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-paper-deep">
              <iframe src={embed} title={`${product.title} video`} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : product.videoUrl ? (
            <a href={product.videoUrl} className="text-sm text-forest" target="_blank" rel="noreferrer">
              Watch the video
            </a>
          ) : null}
          {(product.cta === "quote" || product.cta === "contact") && (product.contactPhone || product.contactEmail) ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Contact</p>
              <p className="mt-1 text-sm">
                {product.contactPhone ? <a className="text-forest" href={`tel:${product.contactPhone}`}>{product.contactPhone}</a> : null}
                {product.contactPhone && product.contactEmail ? " · " : null}
                {product.contactEmail ? <a className="text-forest" href={`mailto:${product.contactEmail}`}>{product.contactEmail}</a> : null}
              </p>
            </div>
          ) : null}
          <div id="share" className="space-y-4">
            <h2 className="font-serif text-2xl">Share this Twig</h2>
            <ShareBar url={canonical} title={product.title} image={image} qr={qr} />
          </div>
        </div>
      </article>
      <ViewTracker productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </Stage>
  );
}
