import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { getPublicProduct, requireLiveTwig } from "@/lib/catalog";
import { BuyPicker } from "@/components/buy-picker";
import { CopyLink, ShareBar } from "@/components/share-bar";
import { Stage } from "@/components/stage";
import { ViewTracker } from "@/components/view-tracker";
import { Logo } from "@/components/logo";
import { BackButton } from "@/components/back-button";
import { PayMethods } from "@/components/pay-methods";
import { Stars } from "@/components/stars";
import { toggleLikeAction, toggleSaved } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { isFavorite, isLiked, likeCount, listProductReviews, sellerReviewSummary } from "@/lib/db";
import { categoryHref, categoryLabel, resolveCategory } from "@/lib/categories";
import { appUrl, ctaCopy, formatDate, formatMoney, fulfillmentOptions, productUrl, videoEmbed, withSrc } from "@/lib/format";
import { sellerPath } from "@/lib/seller-route";
import { storedUpload } from "@/lib/uploads";

export async function ProductView({
  params,
}: {
  params: Promise<{ username: string; product: string }>;
}) {
  await connection();
  const { username, product: slug } = await params;
  const publicId = sellerPath(username, `/${slug}`);
  if (!publicId) notFound();
  const product = await requireLiveTwig(await getPublicProduct(publicId, slug));
  if (!product) notFound();
  const account = await getCurrentUser();
  const saved = account ? isFavorite(account.id, product.id) : false;
  const liked = account ? isLiked(account.id, product.id) : false;
  const likes = likeCount(product.id);
  const reviews = listProductReviews(product.id);
  const rating = sellerReviewSummary(product.userId);
  const reviewAverage = reviews.length ? reviews.reduce((sum, review) => sum + review.overall, 0) / reviews.length : null;
  const ownTwig = account?.publicId === product.publicId;

  const canonical = productUrl(product.publicId, product.slug);
  const qr = (await QRCode.toString(withSrc(canonical, "qr"), {
    type: "svg",
    margin: 1,
    color: { dark: "#1b4332", light: "#fffdf8" },
  })).replace(/<\?xml.*?\?>/, "");
  const options = fulfillmentOptions(product);
  const cta = ctaCopy(product.cta);
  const buyLabel = product.cta === "buy" ? product.buttonLabel || cta.label : cta.label;
  const showOptions = (product.cta === "buy" || product.cta === "file") && product.hasOptions && product.options.length > 0 && product.priceCents != null;
  const soldOut = (product.cta === "buy" || product.cta === "file") && product.quantityAvailable === 0;
  const category = categoryLabel(product.categoryKind, product.categoryGroup, product.category);
  const categoryLink = resolveCategory(product.categoryKind, product.categoryGroup, product.category, true);
  const embed = videoEmbed(product.videoUrl);
  const image = product.images[0] ? `${appUrl()}${product.images[0]}` : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    category: category || undefined,
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
                  unoptimized={storedUpload(src)}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
        <div className="px-5 pt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{product.location}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight">{product.title}</h1>
          {categoryLink ? (
            <p className="mt-2 text-sm text-muted">
              <Link href={categoryHref(categoryLink.kind)} className="underline-offset-2 hover:underline">
                {categoryLink.kind === "service" ? "Service" : "Product"}
              </Link>
              {" · "}
              <Link href={categoryHref(categoryLink.kind, categoryLink.groupId)} className="underline-offset-2 hover:underline">
                {categoryLink.groupLabel}
              </Link>
              {categoryLink.itemLabel ? (
                <>
                  {" · "}
                  <Link href={categoryHref(categoryLink.kind, categoryLink.groupId, categoryLink.itemId)} className="underline-offset-2 hover:underline">
                    {categoryLink.itemLabel}
                  </Link>
                </>
              ) : null}
            </p>
          ) : category ? (
            <p className="mt-2 text-sm text-muted">{category}</p>
          ) : null}
          {product.brand ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Brand</p>
              <p className="mt-1 text-sm">{product.brand}</p>
            </div>
          ) : null}
          {showOptions ? (
            <BuyPicker
              username={product.publicId}
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
              <SellerCredit username={product.publicId} name={product.displayName} rating={rating} />
              <ProductMarks productId={product.id} path={`/${product.publicId}/${product.slug}`} signedIn={Boolean(account)} ownTwig={ownTwig} saved={saved} liked={liked} likes={likes} />
              {product.cta === "buy" || product.cta === "file" ? <PayMethods methods={product.paymentMethods} cardPaymentUrl="" /> : null}
            </BuyPicker>
          ) : (
            <>
              <p className="mt-2 font-serif text-3xl text-forest">
                {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}
              </p>
              {product.cta === "file" ? (
                <p className="mt-2 text-sm text-muted">The file link and password are emailed after payment.</p>
              ) : null}
              {options.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {options.map((option) => (
                    <li key={option.id} className="rounded-full bg-moss px-3 py-1 text-sm text-forest">
                      {option.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <SellerCredit username={product.publicId} name={product.displayName} rating={rating} />
              <ProductMarks productId={product.id} path={`/${product.publicId}/${product.slug}`} signedIn={Boolean(account)} ownTwig={ownTwig} saved={saved} liked={liked} likes={likes} />
              {product.cta === "buy" || product.cta === "file" ? <PayMethods methods={product.paymentMethods} cardPaymentUrl="" /> : null}
            </>
          )}
        </div>
        {showOptions ? null : (
        <div className="sticky bottom-0 z-10 mt-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          {soldOut ? (
            <span className="flex h-14 items-center justify-center rounded-2xl bg-paper-deep text-lg text-muted">Sold out</span>
          ) : (
            <Link href={`/${product.publicId}/${product.slug}/${cta.href}`} className="flex h-14 items-center justify-center rounded-2xl bg-forest text-lg text-card">
              {buyLabel}
            </Link>
          )}
        </div>
        )}
        <div className="space-y-5 px-5 py-5">
          <p className="whitespace-pre-wrap text-[15px] leading-7">{product.description}</p>
          {reviews.length > 0 && reviewAverage != null ? (
            <section>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-serif text-2xl">Reviews</h2>
                <div className="pt-1 text-right">
                  <p className="flex items-center justify-end gap-1.5 text-sm text-forest">
                    <Stars value={reviewAverage} />
                    <span className="font-medium text-ink">{reviewAverage.toFixed(1)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Reviewed by {reviews.length} {reviews.length === 1 ? "person" : "people"}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="border-t border-line pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{review.displayName}</p>
                      <Stars value={review.overall} />
                    </div>
                    {review.body ? <p className="mt-1 text-sm leading-6">{review.body}</p> : null}
                    {review.images.length > 0 ? (
                      <div className="mt-2 flex gap-2">
                        {review.images.map((src) => (
                          <Image key={src} src={src} alt="" width={72} height={72} unoptimized={storedUpload(src)} className="h-[72px] w-[72px] rounded-xl object-cover" />
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">{formatDate(review.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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

function SellerCredit({ username, name, rating }: { username: string; name: string; rating: { average: number | null; count: number } }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
      <span>
        Sold by{" "}
        <Link href={`/${username}`} className="text-ink underline-offset-2 hover:underline">{name}</Link>
      </span>
      {rating.count > 0 && rating.average != null ? (
        <span className="inline-flex items-center gap-1 text-forest">
          <Stars value={rating.average} />
          <span className="font-medium text-ink">{rating.average.toFixed(1)}</span>
          <span className="text-muted">({rating.count})</span>
        </span>
      ) : null}
    </p>
  );
}

function ProductMarks({
  productId,
  path,
  signedIn,
  ownTwig,
  saved,
  liked,
  likes,
}: {
  productId: string;
  path: string;
  signedIn: boolean;
  ownTwig: boolean;
  saved: boolean;
  liked: boolean;
  likes: number;
}) {
  const login = `/login?next=${encodeURIComponent(path)}`;
  return (
    <div className="mt-3 flex items-center gap-4">
      {signedIn && !ownTwig ? (
        <form action={toggleLikeAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="next" value={path} />
          <button aria-label={liked ? "Unlike" : "Like"} className={`inline-flex items-center gap-1.5 bg-transparent p-0 ${liked ? "text-forest" : "text-muted"}`}>
            <HeartIcon filled={liked} />
            <span className="text-sm text-ink">{likes}</span>
          </button>
        </form>
      ) : ownTwig ? (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <HeartIcon filled={false} />
          <span className="text-sm text-ink">{likes}</span>
        </span>
      ) : (
        <Link href={login} aria-label="Like" className="inline-flex items-center gap-1.5 text-muted">
          <HeartIcon filled={false} />
          <span className="text-sm text-ink">{likes}</span>
        </Link>
      )}
      {ownTwig ? null : signedIn ? (
        <form action={toggleSaved}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="next" value={path} />
          <button aria-label={saved ? "Saved" : "Save"} className={`bg-transparent p-0 ${saved ? "text-forest" : "text-muted"}`}>
            <BookmarkIcon filled={saved} />
          </button>
        </form>
      ) : (
        <Link href={login} aria-label="Save" className="text-muted">
          <BookmarkIcon filled={false} />
        </Link>
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 20.5 10.6 19.2C5.4 14.5 2 11.6 2 8.1 2 5.2 4.2 3 7.1 3c1.7 0 3.3.8 4.9 2.3C13.6 3.8 15.2 3 16.9 3 19.8 3 22 5.2 22 8.1c0 3.5-3.4 6.4-8.6 11.1L12 20.5Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-3.4L6 21V4.5a1 1 0 0 1 1-1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
