"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui";
import { useTwigSelectionOptional } from "@/components/twig-selection";
import type { ProductStatus } from "@/lib/types";

export type SellerTwigItem = {
  id: string;
  title: string;
  status: ProductStatus;
  live: boolean;
  updatedAt: string;
  views: number;
  card: ReactNode;
};

const selectClass = `${inputClass} h-10 text-sm`;

export function SellerTwigs({ items }: { items: SellerTwigItem[] }) {
  const [filter, setFilter] = useState("all");
  const [when, setWhen] = useState("all");
  const [sort, setSort] = useState("updated");
  const selection = useTwigSelectionOptional();
  const visible = useMemo(() => {
    const matched = items.filter((item) => matchesStatus(item, filter) && withinWindow(item.updatedAt, when));
    const copy = [...matched];
    copy.sort((left, right) => {
      if (sort === "oldest") return left.updatedAt.localeCompare(right.updatedAt);
      if (sort === "title") return left.title.localeCompare(right.title) || right.updatedAt.localeCompare(left.updatedAt);
      if (sort === "views") return right.views - left.views || right.updatedAt.localeCompare(left.updatedAt);
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    return copy;
  }, [items, filter, when, sort]);
  const visibleIds = visible.map((item) => item.id);
  const selectedCount = selection ? visibleIds.filter((id) => selection.selected.has(id)).length : 0;
  const allVisible = visibleIds.length > 0 && selectedCount === visibleIds.length;

  return (
    <>
      <div className={`mt-4 grid gap-2 ${selection ? "sm:grid-cols-[auto_minmax(0,1fr)_11rem_12rem]" : "sm:grid-cols-[minmax(0,1fr)_11rem_12rem]"} sm:items-center`}>
        {selection ? (
          <VisibleSelect
            allVisible={allVisible}
            selectedCount={selectedCount}
            onToggle={() => selection.setIds(visibleIds, !allVisible)}
          />
        ) : null}
        <select aria-label="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} className={selectClass}>
          <option value="all">All Twigs</option>
          <option value="live">Live</option>
          <option value="draft">Drafts</option>
          <option value="inactive">Inactive</option>
        </select>
        <select aria-label="Updated" value={when} onChange={(event) => setWhen(event.target.value)} className={selectClass}>
          <option value="all">Any time</option>
          <option value="week">Updated in 7 days</option>
          <option value="month">Updated in 30 days</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
          <option value="updated">Last updated</option>
          <option value="oldest">Oldest update</option>
          <option value="title">Title</option>
          <option value="views">Most views</option>
        </select>
      </div>
      {visible.length === 0 ? <p className="mt-6 text-sm text-muted">No Twigs match.</p> : (
        <div className="mt-4 space-y-3">
          {visible.map((item) => <div key={item.id}>{item.card}</div>)}
        </div>
      )}
    </>
  );
}

function VisibleSelect({
  allVisible,
  selectedCount,
  onToggle,
}: {
  allVisible: boolean;
  selectedCount: number;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !allVisible;
  }, [allVisible, selectedCount]);
  return (
    <label className="flex h-10 items-center gap-2 text-sm">
      <input
        ref={ref}
        type="checkbox"
        checked={allVisible}
        onChange={onToggle}
        aria-label="Select visible Twigs"
        className="h-5 w-5 shrink-0 accent-forest"
      />
      <span>Select</span>
    </label>
  );
}

function matchesStatus(item: SellerTwigItem, filter: string) {
  if (filter === "live") return item.live;
  if (filter === "draft") return item.status === "draft";
  if (filter === "inactive") return !item.live && item.status !== "draft";
  return true;
}

function withinWindow(iso: string, when: string) {
  if (when === "all") return true;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  const days = when === "week" ? 7 : 30;
  return Date.now() - time < days * 24 * 60 * 60 * 1000;
}
