"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { payAndPublish } from "@/lib/actions";
import { groupsFor, isCategoryKind, listingTypes, matchesListing, type CategoryKind } from "@/lib/categories";
import { DeactivateTwig } from "@/components/deactivate-twig";
import { inputClass } from "@/components/ui";

export type SellerCard = {
  slug: string;
  title: string;
  location: string;
  priceLabel: string;
  ctaLabel: string;
  image: string;
  inactive?: boolean;
  editHref?: string;
  manage?: {
    productId: string;
    mode: "live" | "ending" | "deactivated";
    endsLabel: string;
    deleteLabel: string;
    stillPaid: boolean;
    waiveFee?: boolean;
    next: string;
  };
  categoryKind: string;
  categoryGroup: string;
  category: string;
};

const selectClass = `${inputClass} h-10 text-sm`;

export function SellerListings({ username, listings }: { username: string; listings: SellerCard[] }) {
  const [kind, setKind] = useState<CategoryKind | "">("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");
  const groups = kind ? groupsFor(kind) : [];
  const items = groups.find((row) => row.id === category)?.items ?? [];
  const categoryValue = groups.some((row) => row.id === category) ? category : "";
  const subcategoryValue = items.some((row) => row.id === subcategory) ? subcategory : "";
  const visible = listings.filter((item) =>
    matchesListing(item, { kind, category: categoryValue, subcategory: subcategoryValue, query }),
  );

  const detailed = listings.length > 6;
  const countLabel = listings.length === 1 ? "1 listing" : `${listings.length} listings`;
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Explore listings</h2>
        <p className="text-sm text-muted">{countLabel}</p>
      </div>
      <div className="mt-3 flex gap-2 text-sm" role="tablist" aria-label="Listing type">
        {[{ id: "", label: "All" }, ...listingTypes.map((row) => ({ id: row.id, label: row.label === "Product" ? "Products" : "Services" }))].map((row) => {
          const selected = kind === row.id;
          return (
            <button
              key={row.label}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setKind(isCategoryKind(row.id) ? row.id : "");
                setCategory("");
                setSubcategory("");
              }}
              className={`h-9 rounded-full px-4 ${selected ? "bg-paper-deep font-medium text-ink" : "text-muted"}`}
            >
              {row.label}
            </button>
          );
        })}
      </div>
      {detailed ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this seller"
            aria-label="Search this seller"
            className={selectClass}
          />
          <select
            key={kind || "none"}
            aria-label="Category"
            defaultValue=""
            disabled={!kind}
            onChange={(event) => {
              setCategory(event.target.value);
              setSubcategory("");
            }}
            className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="">{kind ? "All categories" : "Choose a type first"}</option>
            {groups.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <select
            key={`${kind}:${categoryValue || "none"}`}
            aria-label="Subcategory"
            defaultValue=""
            disabled={!categoryValue}
            onChange={(event) => setSubcategory(event.target.value)}
            className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="">{categoryValue ? "All subcategories" : "Choose a category first"}</option>
            {items.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {visible.length === 0 ? <p className="mt-6 text-muted">Nothing matches.</p> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {visible.map((product) => {
          const href = product.inactive ? "" : `/${username}/${product.slug}`;
          const photo = product.image ? <Image src={product.image} alt={product.title} fill unoptimized={product.image.startsWith("/uploads/")} className="object-cover" sizes="360px" /> : null;
          return (
            <li key={product.slug} className="overflow-hidden rounded-3xl border border-line bg-card">
              {href ? (
                <Link href={href} className="relative block aspect-[4/3] bg-paper-deep">{photo}</Link>
              ) : (
                <div className="relative aspect-[4/3] bg-paper-deep">{photo}</div>
              )}
              <div className="p-4">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{product.categoryKind === "service" ? "Service" : "Product"}</p>
                <h2 className="mt-1 text-base font-semibold">
                  {href ? <Link href={href}>{product.title}</Link> : product.title}
                </h2>
                <p className="mt-1 text-sm text-muted">{product.priceLabel}</p>
                <p className="mt-2 text-sm font-medium text-forest">{product.ctaLabel}</p>
                {product.inactive ? <p className="mt-2 text-sm text-muted">Inactive</p> : null}
                {product.editHref || product.manage ? (
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    {product.editHref ? (
                      <Link href={product.editHref} className="font-medium text-forest">
                        Edit
                      </Link>
                    ) : null}
                    {product.manage && product.manage.mode !== "deactivated" ? (
                      <DeactivateTwig
                        productId={product.manage.productId}
                        mode={product.manage.mode}
                        endsLabel={product.manage.endsLabel}
                        deleteLabel={product.manage.deleteLabel}
                        next={product.manage.next}
                      />
                    ) : null}
                    {product.manage?.mode === "deactivated" ? (
                      product.manage.stillPaid ? (
                        <DeactivateTwig
                          productId={product.manage.productId}
                          mode="deactivated"
                          endsLabel={product.manage.endsLabel}
                          deleteLabel={product.manage.deleteLabel}
                          next={product.manage.next}
                        />
                      ) : (
                        <form action={payAndPublish}>
                          <input type="hidden" name="id" value={product.manage.productId} />
                          <input type="hidden" name="next" value={product.manage.next} />
                          <button className="font-medium text-forest">{product.manage.waiveFee ? "Reactivate" : "Pay and reactivate"}</button>
                        </form>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
