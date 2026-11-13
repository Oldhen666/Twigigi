import Image from "next/image";
import Link from "next/link";
import { payAndPublish, payToResume, reactivateTwig, setListingFree, setListingRenewal } from "@/lib/actions";
import { formatListingFee, listingFeeCents, listingFeeCurrency, listingStillPaid } from "@/lib/billing";
import { DeactivateTwig } from "@/components/deactivate-twig";
import { DeleteTwig } from "@/components/delete-twig";
import { CopyLink } from "@/components/share-bar";
import { TwigCheckbox } from "@/components/twig-selection";
import { TwigMore } from "@/components/twig-more";
import { addDays, DEACTIVATION_GRACE_DAYS, formatBillingDate, formatMoney, isTwigLive, productUrl } from "@/lib/format";
import { storedUpload } from "@/lib/uploads";
import type { Product } from "@/lib/types";

const pill = "inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-sm";

export function TwigCard({
  product,
  publicId,
  acting,
  canDelete,
  selectable = false,
  returnTo = "/dashboard/twigs",
}: {
  product: Product;
  publicId: string;
  acting: boolean;
  canDelete: boolean;
  selectable?: boolean;
  returnTo?: string;
}) {
  const live = isTwigLive(product);
  const ending = live && Boolean(product.deactivatesAt);
  const restricted = product.moderationStatus === "restricted";
  const url = productUrl(publicId, product.slug);
  const paused = product.billingStatus === "paused";
  const badge = restricted ? "Restricted" : paused ? "Paused" : product.status === "deactivated" ? "Inactive" : ending ? "Ending" : live ? "Live" : "Draft";
  const free = product.feeExempt;
  const skipPay = free || acting;
  const currency = listingFeeCurrency(product.cta, product.location);
  const fee = listingFeeCents(product.cta);
  const listingLabel = formatListingFee(currency);
  const renews = product.nextRenewalAt ? shortDate(product.nextRenewalAt) : "";
  const endsLabel = product.deactivatesAt ? formatBillingDate(product.deactivatesAt) : product.paidUntil ? formatBillingDate(product.paidUntil) : "";
  const deactivatedLabel = product.deactivatedAt ? shortDate(product.deactivatedAt) : "";
  const deleteAnchor = product.status === "deactivated" && product.deactivatedAt ? product.deactivatedAt : product.deactivatesAt || product.paidUntil || "";
  const deleteLabel = deleteAnchor ? formatBillingDate(addDays(deleteAnchor, DEACTIVATION_GRACE_DAYS), true) : "";
  const price = product.priceCents != null ? `${formatMoney(product.priceCents, product.currency)} ${product.currency}` : "Pricing on request";
  const views = `${product.viewCount} ${product.viewCount === 1 ? "view" : "views"}`;
  const publishLabel = skipPay || fee === 0 ? "Publish" : `Publish · ${listingLabel}/month`;
  const paidThrough = product.status === "deactivated" && listingStillPaid(product);
  const showDeactivate = product.status === "published";
  const showDelete = canDelete && (product.status === "draft" || product.status === "deactivated");
  const period = product.paidUntil ? `Paid until ${formatBillingDate(product.paidUntil)}` : product.billingStatus === "legacy_review" ? "Not on automatic billing" : "";

  return (
    <article className="flex gap-3 rounded-3xl border border-line bg-card p-3">
      {selectable ? <TwigCheckbox id={product.id} title={product.title} /> : null}
      {live ? (
        <Link href={url} aria-label={product.title} className="relative block size-16 shrink-0 overflow-hidden rounded-2xl bg-paper-deep">
          {product.images[0] ? <Image src={product.images[0]} alt="" fill unoptimized={storedUpload(product.images[0])} className="object-cover" sizes="64px" /> : null}
        </Link>
      ) : (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-paper-deep">
          {product.images[0] ? <Image src={product.images[0]} alt="" fill unoptimized={storedUpload(product.images[0])} className="object-cover" sizes="64px" /> : null}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          {live ? (
            <Link href={url} className="min-w-0 font-medium leading-5 hover:underline">{product.title}</Link>
          ) : (
            <h3 className="min-w-0 font-medium leading-5">{product.title}</h3>
          )}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${live && !ending ? "bg-moss text-forest" : "bg-paper-deep text-muted"}`}>{badge}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{price} · {views}</p>
        <p className="mt-1 text-sm text-muted">
          {restricted ? "Hidden while Twigigi reviews it." : null}
          {!restricted && paused ? "Paused until the listing fee is paid" : null}
          {!restricted && live && !ending ? (free ? "Free" : product.billingStatus === "legacy_review" ? "Not on automatic billing" : fee > 0 && renews ? `Renews ${renews} · ${listingLabel} / 30 days` : fee > 0 ? `${listingLabel} / 30 days` : "No listing fee") : null}
          {!restricted && ending ? `Active until ${shortDate(product.deactivatesAt || "")}` : null}
          {!restricted && product.status === "deactivated" ? `Inactive${deactivatedLabel ? ` since ${deactivatedLabel}` : ""}` : null}
          {!restricted && product.status === "draft" ? "Not published" : null}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/products/${product.id}`} className={pill}>Edit</Link>
          {live ? <CopyLink url={url} className={pill} /> : null}
          {paused ? (
            <form action={payToResume}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="next" value={returnTo} />
              <button className="inline-flex h-9 items-center rounded-full bg-forest px-4 text-sm font-medium text-card">Pay to resume</button>
            </form>
          ) : null}
          {product.status === "draft" ? (
            <form action={payAndPublish}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="next" value={returnTo} />
              <button className="inline-flex h-9 items-center rounded-full bg-forest px-4 text-sm font-medium text-card">{publishLabel}</button>
            </form>
          ) : null}
          {product.status === "deactivated" && paidThrough ? (
            <form action={reactivateTwig}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="next" value={returnTo} />
              <button className="inline-flex h-9 items-center rounded-full bg-forest px-4 text-sm font-medium text-card">Reactivate</button>
            </form>
          ) : null}
          {product.status === "deactivated" && !paidThrough ? (
            <form action={payAndPublish}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="next" value={returnTo} />
              <button className="inline-flex h-9 items-center rounded-full bg-forest px-4 text-sm font-medium text-card">{skipPay || fee === 0 ? "Reactivate" : publishLabel}</button>
            </form>
          ) : null}
          {showDeactivate || showDelete || acting || period ? (
            <TwigMore>
              {period ? <p className="px-3 py-2 text-muted">{period}</p> : null}
              {acting ? (
                <form action={setListingFree}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="free" value={free ? "0" : "1"} />
                  <input type="hidden" name="next" value={returnTo} />
                  <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-paper">{free ? "Charge this Twig" : "Make free forever"}</button>
                </form>
              ) : null}
              {fee > 0 && product.paidUntil && !acting ? (
                <form action={setListingRenewal}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="renew" value={product.autoRenew ? "0" : "1"} />
                  <input type="hidden" name="next" value={returnTo} />
                  <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-paper">{product.autoRenew ? "Turn off auto-renew" : "Turn on auto-renew"}</button>
                </form>
              ) : null}
              {showDeactivate ? (
                <DeactivateTwig productId={product.id} mode={ending ? "ending" : "live"} endsLabel={endsLabel} deleteLabel={deleteLabel} next={returnTo} variant="menu" />
              ) : null}
              {showDelete ? <DeleteTwig productId={product.id} mode={product.status === "deactivated" ? "deactivated" : "draft"} variant="menu" /> : null}
            </TwigMore>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Edmonton" }).format(date);
}
