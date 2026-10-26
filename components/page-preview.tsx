import { ctaCopy, formatMoney, pickupDetail, videoEmbed } from "@/lib/format";
import { normalizeQuoteForm } from "@/lib/quote-form";
import type { Cta } from "@/lib/types";
import { buttonClass } from "@/components/ui";

const QUOTE_METHODS = [
  ["pickupEnabled", "Local pickup", "Customer picks it up"],
  ["deliveryEnabled", "Local delivery", "You deliver to the customer"],
  ["shippingEnabled", "Shipping", "Ship by mail or courier"],
  ["onsiteEnabled", "On-site service", "You go to the customer's location"],
  ["remoteEnabled", "Remote service", "Provided online or remotely"],
  ["atLocationEnabled", "At my location", "Customer comes to your business/location"],
] as const;

export type PagePreviewDraft = {
  title: string;
  brand: string;
  description: string;
  location: string;
  images: string[];
  priceLabel: string | null;
  methods: { label: string; detail: string }[];
  ctaLabel: string;
  phone: string;
  videoUrl: string;
  quoteFields: { label: string; required: boolean; upload?: boolean }[];
  sellerName: string;
};

export function readPagePreview(formData: FormData, images: string[], cta: Cta, sellerName: string): PagePreviewDraft {
  const title = text(formData, "title") || "Untitled";
  const price = text(formData, "price");
  const amount = Number(price);
  const methods =
    cta === "buy"
      ? [
          formData.get("pickupEnabled") === "on" ? { label: "Local pickup", detail: pickupDetail(text(formData, "pickupNote"), text(formData, "pickupTime")) } : null,
          formData.get("shippingEnabled") === "on"
            ? {
                label: "Delivery / Shipping",
                detail: [text(formData, "shippingNote"), text(formData, "shippingFee") ? `$${text(formData, "shippingFee")}` : ""].filter(Boolean).join(" · ") || "Delivery / Shipping",
              }
            : null,
        ].filter((item): item is { label: string; detail: string } => item !== null)
      : cta === "quote"
        ? QUOTE_METHODS.filter(([name]) => formData.get(name) === "on").map(([, label, detail]) => ({ label, detail }))
        : [];
  return {
    title,
    brand: cta === "contact" ? "" : text(formData, "brand"),
    description: text(formData, "description"),
    location: text(formData, "location"),
    images,
    priceLabel: cta === "buy" && price && Number.isFinite(amount) ? formatMoney(Math.round(amount * 100), "CAD") : cta === "buy" ? "Add a price" : "Pricing on request",
    methods,
    ctaLabel: ctaCopy(cta).label,
    phone: text(formData, "contactPhone"),
    videoUrl: text(formData, "videoUrl"),
    quoteFields: cta === "quote" ? quoteFields(text(formData, "quoteFormJson")) : [],
    sellerName,
  };
}

export function PagePreview({ draft }: { draft: PagePreviewDraft }) {
  const embed = videoEmbed(draft.videoUrl || null);
  return (
    <div className="mt-6">
      <p className="text-sm text-muted">This is what customers see. Nothing is published yet.</p>
      <article className="mt-4 overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_24px_50px_rgba(28,25,21,0.08)]">
        {draft.images.length > 0 ? (
          <div className="flex snap-x snap-mandatory overflow-x-auto">
            {draft.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="aspect-[4/3] w-full shrink-0 snap-center object-cover" />
            ))}
          </div>
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-paper-deep text-sm text-muted">No photo yet</div>
        )}
        <div className="px-5 pt-4">
          {draft.location ? <p className="text-xs uppercase tracking-[0.16em] text-muted">{draft.location}</p> : null}
          <h2 className="mt-2 font-serif text-4xl leading-tight">{draft.title}</h2>
          {draft.brand ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Brand</p>
              <p className="mt-1 text-sm">{draft.brand}</p>
            </div>
          ) : null}
          {draft.priceLabel ? <p className="mt-2 font-serif text-3xl text-forest">{draft.priceLabel}</p> : null}
          {draft.methods.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {draft.methods.map((method) => (
                <li key={method.label} className="rounded-full bg-moss px-3 py-1 text-sm text-forest">
                  {method.label}
                </li>
              ))}
            </ul>
          ) : null}
          {draft.sellerName ? <p className="mt-3 text-sm text-muted">Sold by {draft.sellerName}</p> : null}
        </div>
        <div className="mt-4 border-t border-line px-4 py-3">
          <div className="flex h-14 items-center justify-center rounded-2xl bg-forest text-lg text-card">{draft.ctaLabel}</div>
        </div>
        <div className="space-y-4 px-5 py-5">
          {draft.description ? <p className="whitespace-pre-wrap text-[15px] leading-7">{draft.description}</p> : <p className="text-sm text-muted">No description yet.</p>}
          {embed ? (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-paper-deep">
              <iframe src={embed} title="Video preview" className="absolute inset-0 h-full w-full" allowFullScreen />
            </div>
          ) : null}
          {draft.phone ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Contact</p>
              <p className="mt-1 text-sm text-forest">{draft.phone}</p>
            </div>
          ) : null}
        </div>
      </article>
      {draft.quoteFields.length > 0 ? (
        <div className="mt-4 rounded-[28px] border border-line bg-card p-5">
          <h2 className="font-serif text-3xl">Get a quote</h2>
          {draft.brand ? (
            <>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted">Service/product provider</p>
              <p className="mt-1 text-sm">{draft.brand}</p>
            </>
          ) : null}
          <div className="mt-4 space-y-3">
            {draft.quoteFields.map((field) => (
              <div key={field.label}>
                <p className="mb-1.5 text-sm font-medium">
                  {field.label}
                  {field.required ? <span className="text-danger"> *</span> : null}
                </p>
                {field.upload ? (
                  <>
                    <div className="flex gap-2">
                      <button type="button" tabIndex={-1} className={`${buttonClass} flex-1`}>
                        Gallery
                      </button>
                      <button type="button" tabIndex={-1} className={`${buttonClass} flex-1`}>
                        Camera
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-muted">No file chosen</p>
                    <p className="mt-1 text-sm text-muted">Gallery or camera. PNG, JPG, Word, or PDF. Up to 4 files, 5 MB each.</p>
                  </>
                ) : (
                  <div className="h-12 rounded-xl border border-line bg-white" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function quoteFields(raw: string) {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const form = normalizeQuoteForm(parsed);
  const fields: { label: string; required: boolean; upload?: boolean }[] = [];
  if (form.askName) fields.push({ label: "Name", required: true });
  fields.push({ label: "Email", required: true });
  if (form.askPhone) fields.push({ label: "Phone", required: true });
  if (form.askCompany) fields.push({ label: "Company", required: false });
  if (form.askAddress) fields.push({ label: "Address", required: true });
  if (form.askQuantity) fields.push({ label: "Quantity", required: true });
  for (const question of form.questions) fields.push({ label: question.label, required: question.required });
  fields.push({ label: "Additional documentation", required: false, upload: true });
  return fields;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
