import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sendMessage } from "@/lib/actions";
import { getPublicProduct, requireLiveTwig, staticProductParams } from "@/lib/catalog";
import { sellerPath } from "@/lib/seller-route";
import { CheckoutForm } from "@/components/checkout-form";
import { ProductFallback, Stage } from "@/components/stage";

export function generateStaticParams() {
  return staticProductParams()
    .filter((item) => item.cta === "contact")
    .map(({ username, product }) => ({ username, product }));
}

export async function generateMetadata({ params }: { params: Promise<{ username: string; product: string }> }) {
  const { username, product } = await params;
  const publicId = sellerPath(username, `/${product}/contact`);
  const item = publicId ? await requireLiveTwig(await getPublicProduct(publicId, product)) : null;
  return { title: item ? `Contact about ${item.title}` : "Contact", robots: { index: false, follow: false } };
}

async function ContactDetails({ params }: { params: Promise<{ username: string; product: string }> }) {
  const { username, product: slug } = await params;
  const publicId = sellerPath(username, `/${slug}/contact`);
  const product = publicId ? await requireLiveTwig(await getPublicProduct(publicId, slug)) : null;
  if (!product || product.cta !== "contact") notFound();
  return (
    <Stage>
      <div className="bg-card px-5 py-6 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(70,48,16,0.08)]">
        <Link href={`/${product.publicId}/${product.slug}`} className="text-sm text-muted">
          ← {product.title}
        </Link>
        <h1 className="mt-3 font-serif text-4xl">Contact {product.displayName}</h1>
        <p className="mt-2 text-sm text-muted">No Twigigi account needed.</p>
        <div className="mt-6">
          <CheckoutForm
            mode="contact"
            action={sendMessage}
            productId={product.id}
            currency={product.currency}
            priceCents={null}
            options={[]}
          />
        </div>
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ username: string; product: string }> }) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <ContactDetails params={params} />
    </Suspense>
  );
}
