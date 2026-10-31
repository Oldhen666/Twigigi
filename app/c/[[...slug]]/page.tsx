import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { categoryHref, categoryLabel, groupsFor, isCategoryKind, listingTypes, parseCategoryPath, resolveCategory } from "@/lib/categories";
import { filterLiveTwigs } from "@/lib/catalog";
import { listPublishedMatching } from "@/lib/db";
import { ctaCopy, formatMoney } from "@/lib/format";

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = parseCategoryPath(slug);
  if (!path) return { title: "Browse" };
  if (!path.kind) return { title: "Browse", alternates: { canonical: "/c" } };
  const found = path.groupId ? resolveCategory(path.kind, path.groupId, path.itemId, true) : null;
  const title = found?.itemLabel || found?.groupLabel || (path.kind === "service" ? "Services" : "Products");
  return { title, alternates: { canonical: categoryHref(path.kind, path.groupId, path.itemId) } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { slug } = await params;
  const path = parseCategoryPath(slug);
  if (!path) notFound();
  const query = await searchParams;
  const q = first(query.q);
  const products = await filterLiveTwigs(
    listPublishedMatching({
      kind: path.kind,
      category: path.groupId,
      subcategory: path.itemId,
      query: q,
    }),
  );
  const found = path.groupId ? resolveCategory(path.kind, path.groupId, path.itemId, true) : null;
  const title = !path.kind ? "Browse" : found?.itemLabel || found?.groupLabel || (path.kind === "service" ? "Services" : "Products");
  const groups = path.kind && isCategoryKind(path.kind) ? groupsFor(path.kind) : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <Logo />
      <div className="mt-3">
        <BackButton />
      </div>
      <p className="mt-10 text-sm text-muted">
        <Link href="/c" className="hover:underline">
          Browse
        </Link>
        {path.kind ? (
          <>
            {" · "}
            <Link href={categoryHref(path.kind)} className="hover:underline">
              {path.kind === "service" ? "Service" : "Product"}
            </Link>
          </>
        ) : null}
        {found ? (
          <>
            {" · "}
            <Link href={categoryHref(found.kind, found.groupId)} className="hover:underline">
              {found.groupLabel}
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="mt-2 font-serif text-5xl">{title}</h1>
      <form action={categoryHref(path.kind, path.groupId, path.itemId)} className="mt-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search listings"
          aria-label="Search listings"
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none ring-forest/30 placeholder:text-muted/70 focus:border-forest focus:ring-2"
        />
      </form>
      {!path.kind ? (
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {listingTypes.map((type) => (
            <section key={type.id}>
              <h2 className="font-serif text-2xl">
                <Link href={categoryHref(type.id)} className="hover:underline">
                  {type.label}
                </Link>
              </h2>
              <ul className="mt-3 space-y-1">
                {groupsFor(type.id).map((group) => (
                  <li key={group.id}>
                    <Link href={categoryHref(type.id, group.id)} className="text-sm text-forest hover:underline">
                      {group.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={categoryHref(path.kind, path.groupId)} className={`rounded-full border px-3 py-1 text-sm ${path.itemId ? "border-line text-ink" : "border-forest bg-moss text-forest"}`}>
            All
          </Link>
          {(path.groupId ? groups.filter((group) => group.id === path.groupId) : groups).map((group) =>
            path.groupId ? (
              group.items.map((item) => (
                <Link
                  key={item.id}
                  href={categoryHref(path.kind, group.id, item.id)}
                  className={`rounded-full border px-3 py-1 text-sm ${path.itemId === item.id ? "border-forest bg-moss text-forest" : "border-line text-ink"}`}
                >
                  {item.label}
                </Link>
              ))
            ) : (
              <Link key={group.id} href={categoryHref(path.kind, group.id)} className="rounded-full border border-line px-3 py-1 text-sm text-ink">
                {group.label}
              </Link>
            ),
          )}
        </div>
      )}
      {path.kind || q ? (
        products.length === 0 ? (
          <p className="mt-8 text-muted">No listings yet.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/${product.username}/${product.slug}`} className="block overflow-hidden rounded-3xl border border-line bg-card">
                  <div className="relative aspect-[4/3] bg-paper-deep">
                    {product.images[0] ? <Image src={product.images[0]} alt={product.title} fill className="object-cover" sizes="360px" /> : null}
                  </div>
                  <div className="p-4">
                    <h2 className="font-serif text-2xl">{product.title}</h2>
                    <p className="mt-1 text-sm text-forest">{categoryLabel(product.categoryKind, product.categoryGroup, product.category)}</p>
                    <p className="mt-1 text-sm text-muted">{product.location}</p>
                    <p className="mt-2 font-serif text-xl text-forest">
                      {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}
                    </p>
                    <p className="mt-2 text-sm text-forest">{ctaCopy(product.cta).label}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </main>
  );
}
