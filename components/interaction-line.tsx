import Link from "next/link";
import { confirmInteraction } from "@/lib/actions";
import { interactionLabel } from "@/lib/format";

export function InteractionLine({
  item,
  nextPath,
  side,
  showReview = true,
}: {
  item: { id: string; publicRef: string; buyerConfirmedAt: string | null; sellerConfirmedAt: string | null };
  nextPath: string;
  side: "buyer" | "seller";
  showReview?: boolean;
}) {
  const confirmed = side === "buyer" ? item.buyerConfirmedAt : item.sellerConfirmedAt;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">{item.publicRef} · {interactionLabel(item)}</span>
      {confirmed ? (
        showReview && side === "buyer" && item.buyerConfirmedAt ? <Link href="/orders" className="text-forest">Review the seller</Link> : null
      ) : (
        <form action={confirmInteraction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="side" value={side} />
          <input type="hidden" name="next" value={nextPath} />
          <button className="text-forest">Mark completed</button>
        </form>
      )}
    </div>
  );
}
