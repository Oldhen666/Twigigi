import { AdminListTools } from "@/components/admin-list-tools";
import Link from "next/link";
import { adminConfirmInteraction } from "@/lib/actions";
import { emptyListMessage, includesText, pick, queryValue, sortRows } from "@/lib/admin-list";
import { requireAdmin } from "@/lib/auth";
import { listAllInteractions } from "@/lib/db";
import { interactionLabel } from "@/lib/format";

const KINDS = ["", "order", "quote"] as const;
const CONFIRMED = ["", "both", "buyer", "seller", "open"] as const;
const SORTS = ["newest", "oldest", "title"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const q = queryValue(query.q);
  const kind = pick(queryValue(query.kind), KINDS);
  const confirmed = pick(queryValue(query.confirmed), CONFIRMED);
  const sort = pick(queryValue(query.sort), SORTS, "newest");
  const all = listAllInteractions();
  const interactions = sortRows(
    all.filter((item) => {
      if (kind && item.kind !== kind) return false;
      const buyer = Boolean(item.buyerConfirmedAt);
      const seller = Boolean(item.sellerConfirmedAt);
      if (confirmed === "both" && !(buyer && seller)) return false;
      if (confirmed === "buyer" && !buyer) return false;
      if (confirmed === "seller" && !seller) return false;
      if (confirmed === "open" && (buyer || seller)) return false;
      return includesText(q, [item.publicRef, item.productTitle, item.sellerName, item.buyerEmail]);
    }),
    (item) => (sort === "title" ? item.productTitle : item.createdAt),
    sort === "oldest" || sort === "title" ? "asc" : "desc",
  );
  const empty = emptyListMessage(interactions.length, all.length, "No orders or quotes yet.");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Interactions</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Both sides confirming makes a verified transaction. A buyer confirmation alone is enough for a review.</p>
      <AdminListTools
        path="/admin/interactions"
        q={q}
        shown={interactions.length}
        total={all.length}
        sort={sort}
        sorts={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
          { value: "title", label: "Title" },
        ]}
        filters={[
          { name: "kind", label: "Type", value: kind, options: [{ value: "", label: "Orders and quotes" }, { value: "order", label: "Orders" }, { value: "quote", label: "Quotes" }] },
          { name: "confirmed", label: "Confirmed", value: confirmed, options: [{ value: "", label: "Any confirmation" }, { value: "both", label: "Both sides" }, { value: "buyer", label: "Buyer" }, { value: "seller", label: "Seller" }, { value: "open", label: "Not confirmed" }] },
        ]}
      />
      {empty ? <p className="mt-6 text-sm text-muted">{empty}</p> : (
      <ul className="mt-6 space-y-3">
        {interactions.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
            <p className="font-medium">{item.publicRef} · {item.productTitle}</p>
            <p className="text-muted">{item.kind} · {item.sellerName} · {item.buyerEmail} · {interactionLabel(item)}</p>
            <p className="mt-2">
              <Link href={item.kind === "order" ? `/order/${item.sourceId}` : `/quote/${item.sourceId}`} className="font-medium text-forest">
                {item.kind === "order" ? "View order" : "View quote"}
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmButton id={item.id} side="buyer" on={!item.buyerConfirmedAt} label={item.buyerConfirmedAt ? "Clear buyer" : "Buyer confirmed"} />
              <ConfirmButton id={item.id} side="seller" on={!item.sellerConfirmedAt} label={item.sellerConfirmedAt ? "Clear seller" : "Seller confirmed"} />
            </div>
          </li>
        ))}
      </ul>
      )}
    </main>
  );
}

function ConfirmButton({ id, side, on, label }: { id: string; side: "buyer" | "seller"; on: boolean; label: string }) {
  return (
    <form action={adminConfirmInteraction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="on" value={on ? "1" : "0"} />
      <button className="inline-flex h-9 items-center rounded-full border border-line bg-white px-3">{label}</button>
    </form>
  );
}
