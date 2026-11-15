"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleFollowSeller } from "@/lib/actions";
import { BuyerTools, narrowBuyerList } from "@/components/buyer-tools";
import { BuyerSection } from "@/components/buyer-section";

export type FollowedSeller = {
  publicId: string;
  displayName: string;
  username: string;
  followedAt: string;
  listings: number;
};

const filters = [
  { value: "all", label: "All sellers" },
  { value: "listings", label: "Has listings" },
  { value: "none", label: "No listings" },
];

const sorts = [
  { value: "recent", label: "Recently followed" },
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

export function BuyerFollowing({ sellers }: { sellers: FollowedSeller[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const visible = useMemo(() => narrowBuyerList(sellers, match, order, query, filter, sort), [sellers, query, filter, sort]);
  return (
    <>
      {sellers.length > 0 ? (
        <BuyerTools
          query={query}
          onQuery={setQuery}
          placeholder="Name or username"
          searchLabel="Search sellers you follow"
          filter={filter}
          onFilter={setFilter}
          filters={filters}
          sort={sort}
          onSort={setSort}
          sorts={sorts}
        />
      ) : null}
      <BuyerSection title="Following" center={sellers.length === 0}>
        {sellers.length === 0 ? <p className="text-sm text-muted">Sellers you follow will show up here.</p> : visible.length === 0 ? <p className="text-sm text-muted">No sellers match.</p> : (
          <ul className="space-y-3">
            {visible.map((seller) => (
              <li key={seller.publicId} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4">
                <Link href={`/${seller.publicId}`} className="min-w-0">
                  <span className="block font-serif text-2xl">{seller.displayName}</span>
                  <span className="block text-sm text-muted">{seller.username}{seller.listings > 0 ? ` · ${seller.listings} ${seller.listings === 1 ? "listing" : "listings"}` : ""}</span>
                </Link>
                <form action={toggleFollowSeller}>
                  <input type="hidden" name="seller" value={seller.publicId} />
                  <input type="hidden" name="next" value="/following" />
                  <button className="text-sm text-forest">Unfollow</button>
                </form>
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

function match(seller: FollowedSeller, query: string, filter: string) {
  if (!includes(query, [seller.displayName, seller.username])) return false;
  if (filter === "listings") return seller.listings > 0;
  if (filter === "none") return seller.listings < 1;
  return true;
}

function order(sellers: FollowedSeller[], sort: string) {
  const copy = [...sellers];
  if (sort === "name") return copy.sort((left, right) => left.displayName.localeCompare(right.displayName));
  if (sort === "name-desc") return copy.sort((left, right) => right.displayName.localeCompare(left.displayName));
  return copy.sort((left, right) => right.followedAt.localeCompare(left.followedAt));
}
