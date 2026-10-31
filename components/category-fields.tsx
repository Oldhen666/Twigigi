"use client";

import { useState } from "react";
import { groupsFor, isCategoryKind, listingTypes, type CategoryKind } from "@/lib/categories";
import { inputClass, labelClass } from "@/components/ui";

const selectClass = `${inputClass} disabled:cursor-not-allowed disabled:bg-paper-deep disabled:opacity-70`;

export function CategoryFields({
  kind,
  group,
  item,
  error,
}: {
  kind: string;
  group: string;
  item: string;
  error?: string;
}) {
  const initialKind: CategoryKind | "" = isCategoryKind(kind) ? kind : "";
  const [selectedKind, setSelectedKind] = useState<CategoryKind | "">(initialKind);
  const [selectedGroup, setSelectedGroup] = useState(group);
  const [selectedItem, setSelectedItem] = useState(item);
  const groups = selectedKind ? groupsFor(selectedKind) : [];
  const items = groups.find((row) => row.id === selectedGroup)?.items ?? [];
  const groupValue = groups.some((row) => row.id === selectedGroup) ? selectedGroup : "";
  const itemValue = items.some((row) => row.id === selectedItem) ? selectedItem : "";

  return (
    <div className="relative z-20">
      <span className={labelClass}>
        Listing type
        <span className="text-danger"> *</span>
        <span className="ml-1 font-normal text-muted"> Required</span>
      </span>
      <div className="space-y-3">
        <select
          name="categoryKind"
          defaultValue={selectedKind}
          aria-label="Listing type"
          onChange={(event) => {
            const next = event.target.value;
            setSelectedKind(isCategoryKind(next) ? next : "");
            setSelectedGroup("");
            setSelectedItem("");
          }}
          className={selectClass}
        >
          <option value="">Choose product or service</option>
          {listingTypes.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
        <div className="ml-4 space-y-3 border-l-2 border-line pl-3">
          <label className="block">
            <span className={labelClass}>
              Category
              <span className="text-danger"> *</span>
              <span className="ml-1 font-normal text-muted"> Required</span>
            </span>
            {selectedKind ? (
              <select
                key={selectedKind}
                name="categoryGroup"
                defaultValue={groupValue}
                aria-label="Category"
                onChange={(event) => {
                  setSelectedGroup(event.target.value);
                  setSelectedItem("");
                }}
                className={selectClass}
              >
                <option value="">Choose a category</option>
                {groups.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="categoryGroup" value="" />
                <select disabled aria-label="Category" className={selectClass} defaultValue="">
                  <option value="">Choose a listing type first</option>
                </select>
              </>
            )}
          </label>
          <label className="block">
            <span className={labelClass}>
              Subcategory
              <span className="ml-1 font-normal text-muted"> Optional</span>
            </span>
            {groupValue ? (
              <select
                key={`${selectedKind}:${groupValue}`}
                name="category"
                defaultValue={itemValue}
                aria-label="Subcategory"
                onChange={(event) => setSelectedItem(event.target.value)}
                className={selectClass}
              >
                <option value="">None</option>
                {items.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="category" value="" />
                <select disabled aria-label="Subcategory" className={selectClass} defaultValue="">
                  <option value="">Choose a category first</option>
                </select>
              </>
            )}
          </label>
        </div>
      </div>
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </div>
  );
}
