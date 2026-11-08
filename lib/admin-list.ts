export function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function pick(value: string, allowed: readonly string[], fallback = "") {
  return allowed.includes(value) ? value : fallback;
}

export function includesText(query: string, parts: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.join("\n").toLowerCase().includes(q);
}

export function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function emptyListMessage(shown: number, total: number, empty: string) {
  if (total === 0) return empty;
  if (shown === 0) return "Nothing matches.";
  return "";
}

export function sortRows<T>(rows: T[], read: (row: T) => string | number, direction: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : compareText(String(av), String(bv));
    return direction === "asc" ? cmp : -cmp;
  });
}
