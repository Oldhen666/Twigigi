"use client";

import { useActionState } from "react";
import { reviewOrderProof, sendOrderProof } from "@/lib/actions";
import type { PersonalizationSnapshot } from "@/lib/personalization";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function ProofPanel({
  orderId,
  snapshot,
  role,
  paid,
}: {
  orderId: string;
  snapshot: PersonalizationSnapshot | null;
  role: "seller" | "buyer";
  paid: boolean;
}) {
  const [state, action, pending] = useActionState(role === "seller" ? sendOrderProof : reviewOrderProof, {} as FormState);
  if (!snapshot?.proofRequested) return null;
  const current = snapshot.proofs.find((proof) => proof.current);
  const decided = current && snapshot.decisionProofId === current.id ? snapshot.decision : "";
  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm leading-6">
      <h2 className="font-medium">Proof</h2>
      {role === "seller" && !paid ? <p className="mt-2 text-muted">You can send a proof after payment is confirmed.</p> : null}
      {role === "buyer" && snapshot.proofs.length < 1 ? <p className="mt-2 text-muted">You’ll receive a proof to approve before we start making your item.</p> : null}
      <div className="mt-3 space-y-3">
        {snapshot.proofs.map((proof, index) => (
          <div key={proof.id} className="rounded-xl border border-line p-3">
            <p className="text-muted">{proof.current ? "Current proof" : `Earlier proof ${index + 1}`}</p>
            {proof.note ? <p className="mt-1">{proof.note}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {proof.files.map((file) => (
                <a key={file.path} href={file.path} target="_blank" rel="noreferrer" className="block">
                  <img src={file.path} alt={file.name} className="h-24 w-24 rounded-xl object-cover" />
                  <span className="mt-1 block">{file.name}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      {decided === "approved" ? <p className="mt-3">The current proof is approved.</p> : null}
      {decided === "changes" ? <p className="mt-3">Changes requested{snapshot.decisionNote ? `: ${snapshot.decisionNote}` : "."}</p> : null}
      {state.error ? <p className="mt-3 text-danger">{state.error}</p> : null}
      {role === "seller" && paid ? (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={orderId} />
          <textarea name="note" rows={3} placeholder="Note for this proof" className={`${inputClass} h-auto py-3`} />
          <input name="proof" type="file" accept="image/jpeg,image/png,image/webp" multiple required className={`${inputClass} py-2`} />
          <p className="text-muted">JPG, PNG, or WebP, under 5 MB each. Up to 3.</p>
          <button disabled={pending} className={`${buttonClass} w-full`}>Send proof</button>
        </form>
      ) : null}
      {role === "buyer" && current && decided !== "approved" ? (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={orderId} />
          <textarea name="note" rows={3} placeholder="What should change?" className={`${inputClass} h-auto py-3`} />
          <div className="flex gap-2">
            <button name="decision" value="approved" disabled={pending} className={`${buttonClass} flex-1`}>Approve proof</button>
            <button name="decision" value="changes" disabled={pending} className={`${ghostClass} flex-1`}>Request changes</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
