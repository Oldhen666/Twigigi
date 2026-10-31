"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { deactivateProducts, removeProducts } from "@/lib/actions";
import { ghostClass } from "@/components/ui";

export type TwigPick = {
  id: string;
  title: string;
  status: "draft" | "published" | "deactivated";
  canDelete: boolean;
};

type Selection = {
  items: TwigPick[];
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("Twig selection is missing.");
  return value;
}

export function TwigSelectionProvider({ items, children }: { items: TwigPick[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setAll(on: boolean) {
    setSelected(on ? new Set(items.map((item) => item.id)) : new Set());
  }
  return (
    <SelectionContext.Provider value={{ items, selected, toggle, setAll }}>
      {children}
      <TwigBatchBar />
    </SelectionContext.Provider>
  );
}

export function TwigSelectAll() {
  const { items, selected, setAll } = useSelection();
  const all = items.length > 0 && items.every((item) => selected.has(item.id));
  return (
    <input
      type="checkbox"
      checked={all}
      onChange={(event) => setAll(event.target.checked)}
      aria-label="Select all Twigs"
      className="h-5 w-5 accent-forest"
    />
  );
}

export function TwigCheckbox({ id, title }: { id: string; title: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${title}`}
      className="mt-1 h-5 w-5 shrink-0 accent-forest"
    />
  );
}

function TwigBatchBar() {
  const { items, selected, setAll } = useSelection();
  const [mode, setMode] = useState<"delete" | "deactivate" | null>(null);
  const picks = items.filter((item) => selected.has(item.id));
  if (picks.length === 0) return null;
  const deleting = picks.filter((item) => item.canDelete);
  const deactivating = picks.filter((item) => item.status === "published");
  const voidsTerms = deleting.some((item) => item.status === "deactivated");
  const many = deleting.length !== 1;

  return (
    <>
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card px-5 py-3">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <p className="text-sm text-muted">{picks.length} selected</p>
          <div className="flex gap-4 text-sm">
            <button type="button" onClick={() => setAll(false)} className="font-medium text-muted">Clear</button>
            {deactivating.length > 0 ? (
              <button type="button" onClick={() => setMode("deactivate")} className="font-medium text-danger">Deactivate</button>
            ) : null}
            <button type="button" onClick={() => setMode("delete")} className="font-medium text-danger">Delete</button>
          </div>
        </div>
      </div>
      {mode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setMode(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="twig-batch-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            {mode === "delete" ? (
              <>
                <h2 id="twig-batch-title" className="font-serif text-3xl">{many ? "Delete these Twigs" : "Delete this Twig"}</h2>
                {deleting.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Deactivate a Twig before it can be deleted. Live Twigs stay in this list.</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-muted">
                    <p>{many ? "These Twigs will be permanently deleted. They cannot be recovered." : "This permanently deletes the Twig. It cannot be recovered."}</p>
                    {voidsTerms ? (
                      <p>{many
                        ? "The deactivation payment terms are canceled. Any time already paid is not refunded, and these Twigs cannot be turned back on."
                        : "The deactivation payment terms are canceled. Any time already paid is not refunded, and this Twig cannot be turned back on."}</p>
                    ) : null}
                    {deactivating.length > 0 ? <p>Live Twigs in this selection stay. Deactivate them first.</p> : null}
                    {many ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {deleting.map((item) => <li key={item.id}>{item.title}</li>)}
                      </ul>
                    ) : null}
                  </div>
                )}
                {deleting.length > 0 ? (
                  <form action={removeProducts} className="mt-5">
                    {deleting.map((item) => <input key={item.id} type="hidden" name="id" value={item.id} />)}
                    <button className="inline-flex h-12 w-full items-center justify-center rounded-full bg-danger px-5 text-base font-medium text-card">
                      {many ? `Delete ${deleting.length} Twigs` : "Delete Twig"}
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <>
                <h2 id="twig-batch-title" className="font-serif text-3xl">Deactivate these Twigs?</h2>
                <div className="mt-2 space-y-2 text-sm text-muted">
                  <p>These Twigs become inactive now, and the next scheduled charge is canceled.</p>
                  <p>You can turn each one back on before it is permanently deleted.</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {deactivating.map((item) => <li key={item.id}>{item.title}</li>)}
                  </ul>
                </div>
                <form action={deactivateProducts} className="mt-5">
                  {deactivating.map((item) => <input key={item.id} type="hidden" name="id" value={item.id} />)}
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-full bg-danger px-5 text-base font-medium text-card">Deactivate</button>
                </form>
              </>
            )}
            <button type="button" onClick={() => setMode(null)} className={`${ghostClass} mt-2 w-full`}>Not now</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
