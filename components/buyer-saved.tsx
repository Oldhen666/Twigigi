"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleSaved } from "@/lib/actions";
import { BuyerTools, narrowBuyerList } from "@/components/buyer-tools";
import { BuyerSection } from "@/components/buyer-section";

export type SavedTwigItem = {
  id: string;
  title: string;
  seller: string;
  price: string;
  priceCents: number | null;
  href: string;
  image: string;
  unoptimized: boolean;
  savedAt: string;
  cta: string;
};

const filters = [
  { value: "all", label: "All Twigs" },
  { value: "buy", label: "Buy now" },
  { value: "file", label: "Digital file" },
  { value: "quote", label: "Quote" },
  { value: "contact", label: "Contact" },
];

const sorts = [
  { value: "recent", label: "Recently saved" },
  { value: "title", label: "Title" },
  { value: "price-high", label: "Highest price" },
  { value: "price-low", label: "Lowest price" },
];

export function BuyerSaved({ items }: { items: SavedTwigItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const visible = useMemo(() => narrowBuyerList(items, match, order, query, filter, sort), [items, query, filter, sort]);
  return (
    <>
      {items.length > 0 ? (
        <BuyerTools
          query={query}
          onQuery={setQuery}
          placeholder="Twig or seller"
          searchLabel="Search saved Twigs"
          filter={filter}
          onFilter={setFilter}
          filters={filters}
          sort={sort}
          onSort={setSort}
          sorts={sorts}
        />
      ) : null}
      <BuyerSection title="Saved" center={items.length === 0}>
        {items.length === 0 ? <p className="text-sm text-muted">Save a Twig from its page. It stays here.</p> : visible.length === 0 ? <p className="text-sm text-muted">No saved Twigs match.</p> : (
          <ul className="space-y-3">
            {visible.map((product) => (
              <li key={product.id} className="flex gap-4 rounded-2xl border border-line bg-card p-4">
                <Link href={product.href} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                  {product.image ? <Image src={product.image} alt="" fill unoptimized={product.unoptimized} className="object-cover" sizes="80px" /> : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={product.href} className="font-serif text-2xl">{product.title}</Link>
                  <p className="text-sm text-muted">{product.seller}</p>
                  <p className="mt-1">{product.price}</p>
                  <form action={toggleSaved} className="mt-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="next" value="/saved" />
                    <button className="text-sm text-forest">Remove</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </BuyerSection>
    </>
  );
}

function includes(query: string, values: string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.join(" ").toLowerCase().includes(needle);
}

function match(item: SavedTwigItem, query: string, filter: string) {
  if (!includes(query, [item.title, item.seller, item.price])) return false;
  if (filter === "all") return true;
  return item.cta === filter;
}

function order(items: SavedTwigItem[], sort: string) {
  const copy = [...items];
  if (sort === "title") return copy.sort((left, right) => left.title.localeCompare(right.title));
  if (sort === "price-high") return copy.sort((left, right) => (right.priceCents ?? -1) - (left.priceCents ?? -1));
  if (sort === "price-low") return copy.sort((left, right) => (left.priceCents ?? Number.MAX_SAFE_INTEGER) - (right.priceCents ?? Number.MAX_SAFE_INTEGER));
  return copy.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}
