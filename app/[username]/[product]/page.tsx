import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductView } from "@/components/product-view";
import { ProductFallback } from "@/components/stage";
import { getPublicProduct, requireLiveTwig, staticProductParams } from "@/lib/catalog";
import { sellerPath } from "@/lib/seller-route";
import { formatMoney } from "@/lib/format";

export function generateStaticParams() {
  return staticProductParams().map(({ username, product }) => ({ username, product }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; product: string }>;
}): Promise<Metadata> {
  const { username, product } = await params;
  const publicId = sellerPath(username, `/${product}`);
  const item = publicId ? await requireLiveTwig(await getPublicProduct(publicId, product)) : null;
  if (!item) return { title: "Twig" };
  const description = item.description.slice(0, 180);
  const price = item.priceCents != null ? formatMoney(item.priceCents, item.currency) : null;
  const socialTitle = price ? `${item.title} · ${price}` : item.title;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/${item.publicId}/${item.slug}` },
    openGraph: {
      title: socialTitle,
      description,
      url: `/${item.publicId}/${item.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}

export default function Page({
  params,
}: {
  params: Promise<{ username: string; product: string }>;
}) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <ProductView params={params} />
    </Suspense>
  );
}
