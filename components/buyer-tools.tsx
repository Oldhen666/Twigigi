"use client";

const controlClass = "h-11 rounded-full border border-line bg-card px-4 text-sm text-ink";

export function BuyerTools({
  query,
  onQuery,
  placeholder,
  searchLabel,
  filter,
  onFilter,
  filters,
  sort,
  onSort,
  sorts,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  searchLabel: string;
  filter: string;
  onFilter: (value: string) => void;
  filters: Array<{ value: string; label: string }>;
  sort: string;
  onSort: (value: string) => void;
  sorts: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={searchLabel}
        className={`${controlClass} w-full px-4`}
      />
      <select aria-label="Filter" value={filter} onChange={(event) => onFilter(event.target.value)} className={controlClass}>
        {filters.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <select aria-label="Sort" value={sort} onChange={(event) => onSort(event.target.value)} className={controlClass}>
        {sorts.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </div>
  );
}

export function narrowBuyerList<T>(items: T[], match: (item: T, query: string, filter: string) => boolean, order: (items: T[], sort: string) => T[], query: string, filter: string, sort: string) {
  const matched = items.filter((item) => match(item, query, filter));
  return order(matched, sort);
}
