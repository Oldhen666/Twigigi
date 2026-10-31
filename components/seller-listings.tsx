"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { categoryHref, categoryLabel, groupsFor, isCategoryKind, listingTypes, matchesListing, type CategoryKind } from "@/lib/categories";
import { inputClass } from "@/components/ui";

export type SellerCard = {
  slug: string;
  title: string;
  location: string;
  priceLabel: string;
  ctaLabel: string;
  image: string;
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

  return (
    <div className="mt-8">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Listing type"
          defaultValue=""
          onChange={(event) => {
            const next = event.target.value;
            setKind(isCategoryKind(next) ? next : "");
            setCategory("");
            setSubcategory("");
          }}
          className={selectClass}
        >
          <option value="">All types</option>
          {listingTypes.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
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
      {visible.length === 0 ? <p className="mt-6 text-muted">Nothing matches.</p> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {visible.map((product) => {
          const label = categoryLabel(product.categoryKind, product.categoryGroup, product.category);
          const href = `/${username}/${product.slug}`;
          return (
            <li key={product.slug} className="overflow-hidden rounded-3xl border border-line bg-card">
              <Link href={href} className="relative block aspect-[4/3] bg-paper-deep">
                {product.image ? <Image src={product.image} alt={product.title} fill className="object-cover" sizes="360px" /> : null}
              </Link>
              <div className="p-4">
                <h2 className="font-serif text-2xl">
                  <Link href={href}>{product.title}</Link>
                </h2>
                {label ? (
                  <p className="mt-1 text-sm text-forest">
                    <Link href={categoryHref(product.categoryKind, product.categoryGroup, product.category)} className="underline-offset-2 hover:underline">
                      {label}
                    </Link>
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted">{product.location}</p>
                <p className="mt-2 font-serif text-xl text-forest">{product.priceLabel}</p>
                <p className="mt-2 text-sm text-forest">{product.ctaLabel}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
