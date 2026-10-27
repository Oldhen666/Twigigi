import { adminConfirmInteraction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listAllInteractions } from "@/lib/db";
import { interactionLabel } from "@/lib/format";

export default async function Page() {
  await requireAdmin();
  const interactions = listAllInteractions();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Interactions</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Both sides confirming makes a verified transaction. A buyer confirmation alone is enough for a review.</p>
      {interactions.length === 0 ? <p className="mt-8 text-sm text-muted">No orders or quotes yet.</p> : null}
      <ul className="mt-6 space-y-3">
        {interactions.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
            <p className="font-medium">{item.publicRef} · {item.productTitle}</p>
            <p className="text-muted">{item.kind} · {item.sellerName} · {item.buyerEmail} · {interactionLabel(item)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmButton id={item.id} side="buyer" on={!item.buyerConfirmedAt} label={item.buyerConfirmedAt ? "Clear buyer" : "Buyer confirmed"} />
              <ConfirmButton id={item.id} side="seller" on={!item.sellerConfirmedAt} label={item.sellerConfirmedAt ? "Clear seller" : "Seller confirmed"} />
            </div>
          </li>
        ))}
      </ul>
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
