import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartCheckout } from "@/components/cart-checkout";
import { Stage } from "@/components/stage";
import { getCurrentUser } from "@/lib/auth";
import { filterLiveTwigs, getPublicSeller } from "@/lib/catalog";
import { fulfillmentOptions } from "@/lib/format";
import { sellerPath } from "@/lib/seller-route";

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

async function CheckoutScreen({ params }: { params: Promise<{ username: string }> }) {
  await connection();
  const { username } = await params;
  const publicId = sellerPath(username, "/cart/checkout");
  if (!publicId) notFound();
  const seller = await getPublicSeller(publicId);
  if (!seller) notFound();
  const products = (await filterLiveTwigs(seller.products)).filter((product) => product.cta === "buy" && product.priceCents != null);
  const account = await getCurrentUser();
  return (
    <Stage>
      <div className="bg-card px-5 py-6 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(70,48,16,0.08)]">
        <Link href={`/${seller.publicId}/cart`} className="text-sm text-muted">
          ← Cart
        </Link>
        <h1 className="mt-3 font-serif text-4xl">Checkout</h1>
        <p className="mt-2 text-sm text-muted">Confirm the time and how you want it. Payment comes after the seller confirms.</p>
        <CartCheckout
          mode="checkout"
          publicId={seller.publicId}
          sellerName={seller.displayName}
          defaultName={account?.displayName ?? ""}
          defaultEmail={account?.email ?? ""}
          catalog={products.map((product) => ({
            id: product.id,
            title: product.title,
            slug: product.slug,
            image: product.images[0] ?? "",
            currency: product.currency,
            priceCents: product.priceCents ?? 0,
            quantityAvailable: product.quantityAvailable,
            hasOptions: product.hasOptions,
            samePrice: product.samePrice,
            options: product.options,
            variants: product.variants,
            requireName: product.requireName,
            requirePhone: product.requirePhone,
            paymentMethods: product.paymentMethods,
            cardPaymentUrl: product.cardPaymentUrl,
            interacEmail: product.interacEmail,
            interacQuestion: product.interacQuestion,
            interacPassword: product.interacPassword,
            venmoUsername: product.venmoUsername,
            paypalMe: product.paypalMe,
            fulfillments: fulfillmentOptions(product).filter((option) => option.id === "pickup" || option.id === "delivery" || option.id === "shipping"),
          }))}
        />
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-muted">Loading…</p>}>
      <CheckoutScreen params={params} />
    </Suspense>
  );
}
