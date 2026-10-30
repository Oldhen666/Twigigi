"use client";

import { useState } from "react";
import { groupsFor, type CategoryKind } from "@/lib/categories";
import { inputClass, labelClass } from "@/components/ui";

const selectClass = `${inputClass} disabled:cursor-not-allowed disabled:bg-paper-deep disabled:opacity-70`;
const choiceClass = "h-12 rounded-xl border text-base font-medium";

export function CategoryFields({
  mode,
  kind,
  group,
  item,
  error,
}: {
  mode: "buy" | "quote";
  kind: string;
  group: string;
  item: string;
  error?: string;
}) {
  const initialKind: CategoryKind | "" = mode === "buy" ? "product" : kind === "service" || kind === "product" ? kind : "";
  const [selectedKind, setSelectedKind] = useState<CategoryKind | "">(initialKind);
  const [selectedGroup, setSelectedGroup] = useState(group);
  const [selectedItem, setSelectedItem] = useState(item);
  const groups = selectedKind ? groupsFor(selectedKind) : [];
  const items = groups.find((row) => row.id === selectedGroup)?.items ?? [];
  const groupValue = groups.some((row) => row.id === selectedGroup) ? selectedGroup : "";
  const itemValue = items.some((row) => row.id === selectedItem) ? selectedItem : "";

  function pickKind(next: CategoryKind) {
    setSelectedKind(next);
    setSelectedGroup("");
    setSelectedItem("");
  }

  return (
    <div>
      <span className={labelClass}>
        {mode === "buy" ? "Product category" : "Product or service category"}
        <span className="text-danger"> *</span>
        <span className="ml-1 font-normal text-muted"> Required</span>
      </span>
      <div className="space-y-2">
        {mode === "quote" ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pickKind("product")} className={`${choiceClass} ${selectedKind === "product" ? "border-forest bg-moss text-forest" : "border-line bg-white text-ink"}`}>
              Product
            </button>
            <button type="button" onClick={() => pickKind("service")} className={`${choiceClass} ${selectedKind === "service" ? "border-forest bg-moss text-forest" : "border-line bg-white text-ink"}`}>
              Service
            </button>
            <input type="hidden" name="categoryKind" value={selectedKind} />
          </div>
        ) : (
          <input type="hidden" name="categoryKind" value="product" />
        )}
        <select
          name="categoryGroup"
          value={groupValue}
          disabled={!selectedKind}
          aria-label={selectedKind === "service" ? "Service category" : "Product category"}
          onChange={(event) => {
            setSelectedGroup(event.target.value);
            setSelectedItem("");
          }}
          className={selectClass}
        >
          <option value="">{selectedKind === "service" ? "Choose a service category" : "Choose a product category"}</option>
          {groups.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
        <select
          name="category"
          value={itemValue}
          disabled={!groupValue}
          aria-label="Subcategory"
          onChange={(event) => setSelectedItem(event.target.value)}
          className={selectClass}
        >
          <option value="">Choose a subcategory</option>
          {items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </div>
  );
}
