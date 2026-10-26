import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { placeOrder } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProduct, requireLiveTwig, staticProductParams } from "@/lib/catalog";
import { CheckoutForm } from "@/components/checkout-form";
import { ProductFallback, Stage } from "@/components/stage";
import { formatMoney, fulfillmentOptions } from "@/lib/format";
import { resolveSelection } from "@/lib/variants";

export function generateStaticParams() {
  return staticProductParams()
    .filter((item) => item.cta === "buy")
    .map(({ username, product }) => ({ username, product }));
}

export async function generateMetadata({ params }: { params: Promise<{ username: string; product: string }> }) {
  const { username, product } = await params;
  const item = await requireLiveTwig(await getPublicProduct(username, product));
  return { title: item ? `Buy ${item.title}` : "Buy", robots: { index: false, follow: false } };
}

async function CanceledNote({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.canceled !== "1") return null;
  return <p className="mx-auto max-w-[440px] px-5 pt-4 text-sm text-clay">Payment canceled. Your card was not charged.</p>;
}

async function BuyDetails({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; product: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username, product: slug } = await params;
  const query = await searchParams;
  const product = await requireLiveTwig(await getPublicProduct(username, slug));
  if (!product || product.cta !== "buy" || product.priceCents == null) notFound();
  const variantKey = typeof query.v === "string" ? query.v : "";
  const selection = resolveSelection(product, variantKey);
  const missingOption = product.hasOptions && product.options.length > 0 && !selection;
  const unit = selection?.priceCents ?? product.priceCents;
  const requested = Number(typeof query.qty === "string" ? query.qty : "1");
  const cap = product.quantityAvailable == null ? 20 : Math.min(20, product.quantityAvailable);
  const initialQuantity = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), Math.max(cap, 1)) : 1;
  const account = await getCurrentUser();
  return (
    <Stage>
      <div className="bg-card px-5 py-6 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(70,48,16,0.08)]">
        <Link href={`/${product.username}/${product.slug}`} className="text-sm text-muted">
          ← {product.title}
        </Link>
        <h1 className="mt-3 font-serif text-4xl">{product.buttonLabel || "Buy now"}</h1>
        {selection?.label ? <p className="mt-2 text-muted">{selection.label}</p> : null}
        <p className="mt-2 font-serif text-2xl text-forest">{formatMoney(unit, product.currency)}</p>
        {product.quantityAvailable === 0 ? (
          <p className="mt-6 rounded-xl bg-paper-deep px-3 py-2 text-sm text-muted">This product is sold out.</p>
        ) : missingOption || (selection && !selection.available) ? (
          <p className="mt-6 text-sm text-muted">
            <Link href={`/${product.username}/${product.slug}`} className="text-forest">
              Choose an available option
            </Link>{" "}
            on the Twig.
          </p>
        ) : (
          <div className="mt-6">
            <CheckoutForm
              mode="buy"
              action={placeOrder}
              productId={product.id}
              currency={product.currency}
              priceCents={unit}
              options={fulfillmentOptions(product)}
              variantKey={product.hasOptions ? variantKey : ""}
              variantLabel={selection?.label ?? ""}
              requireName={product.requireName}
              requirePhone={product.requirePhone}
              initialQuantity={initialQuantity}
              maxQuantity={Math.max(cap, 1)}
              defaultName={account?.displayName ?? ""}
              defaultEmail={account?.email ?? ""}
              payments={{
                methods: product.paymentMethods,
                cardPaymentUrl: product.cardPaymentUrl,
                interacEmail: product.interacEmail,
                venmoUsername: product.venmoUsername,
                zelleMode: product.zelleMode,
                zelleContact: product.zelleContact,
              }}
            />
          </div>
        )}
      </div>
    </Stage>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; product: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <CanceledNote searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ProductFallback />}>
        <BuyDetails params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
