import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getProductById, getPublishedProduct, getSellerWithProducts, listPublishedParams } from "@/lib/db";
import { isTwigLive } from "@/lib/format";

export async function requireLiveTwig<T extends { status: string; deactivatesAt?: string | null; id: string }>(product: T | null) {
  if (!product || product.status !== "published") return null;
  if (!product.deactivatesAt) return product;
  await connection();
  const fresh = getProductById(product.id);
  return fresh && isTwigLive(fresh) ? product : null;
}

export async function filterLiveTwigs<T extends { status: string; deactivatesAt?: string | null; id: string }>(products: T[]) {
  const scheduled = products.some((product) => product.status === "published" && product.deactivatesAt);
  if (!scheduled) return products.filter((product) => isTwigLive(product));
  await connection();
  return products.filter((product) => {
    if (!product.deactivatesAt) return isTwigLive(product);
    const fresh = getProductById(product.id);
    return Boolean(fresh && isTwigLive(fresh));
  });
}

export function productTag(username: string, slug: string) {
  return `product:${username}:${slug}`;
}

export function sellerTag(username: string) {
  return `seller:${username}`;
}

export async function getPublicProduct(username: string, slug: string) {
  "use cache";
  cacheLife("days");
  const user = username.toLowerCase();
  const product = slug.toLowerCase();
  cacheTag(productTag(user, product));
  cacheTag(sellerTag(user));
  return getPublishedProduct(user, product);
}

export async function getPublicSeller(username: string) {
  "use cache";
  cacheLife("days");
  const user = username.toLowerCase();
  cacheTag(sellerTag(user));
  return getSellerWithProducts(user);
}

export function staticProductParams() {
  return listPublishedParams();
}
