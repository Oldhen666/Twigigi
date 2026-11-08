import Link from "next/link";

export function AdminListTools({
  path,
  q,
  filters,
  sort,
  sorts,
  shown,
  total,
}: {
  path: string;
  q: string;
  filters: { name: string; label: string; value: string; options: { value: string; label: string }[] }[];
  sort: string;
  sorts: { value: string; label: string }[];
  shown: number;
  total: number;
}) {
  return (
    <form action={path} method="get" className="mt-5 flex flex-wrap items-end gap-2">
      <label className="min-w-52 flex-1">
        <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Search</span>
        <input name="q" defaultValue={q} placeholder="Search" className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm" />
      </label>
      {filters.map((filter) => (
        <label key={filter.name}>
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value} className="h-10 rounded-xl border border-line bg-white px-2 text-sm">
            {filter.options.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
      <label>
        <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Sort</span>
        <select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-line bg-white px-2 text-sm">
          {sorts.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <button className="h-10 rounded-full bg-forest px-4 text-sm text-card">Apply</button>
      <Link href={path} className="inline-flex h-10 items-center px-2 text-sm text-muted">Clear</Link>
      <p className="w-full text-sm text-muted">{shown === total ? `${total} results` : `${shown} of ${total}`}</p>
    </form>
  );
}
