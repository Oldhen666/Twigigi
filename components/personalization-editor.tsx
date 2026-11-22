"use client";

import { useState } from "react";
import type { PersonalizationConfig, PersonalizationField } from "@/lib/personalization";
import { PERSONALIZATION_FILE_HELP, PERSONALIZATION_FILE_LIMIT, PERSONALIZATION_TEXT_LIMIT } from "@/lib/personalization";
import { inputClass } from "@/components/ui";

function fieldId() {
  return `pf_${Math.random().toString(36).slice(2, 8)}`;
}

export function PersonalizationEditor({ initial }: { initial: PersonalizationConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [proof, setProof] = useState(initial.proof);
  const [fields, setFields] = useState<PersonalizationField[]>(initial.fields);
  const config: PersonalizationConfig = { enabled, proof: enabled && proof, fields: enabled ? fields : [] };

  function add(kind: PersonalizationField["kind"]) {
    const id = fieldId();
    const next: PersonalizationField = kind === "text"
      ? { id, kind, label: "", help: "", required: true, maxLength: PERSONALIZATION_TEXT_LIMIT }
      : kind === "file"
        ? { id, kind, label: "", help: "", required: true, maxFiles: 1 }
        : kind === "choice"
          ? { id, kind, label: "", help: "", required: true, options: ["", ""] }
          : { id, kind, label: "Anything else we should know?", help: "", required: false };
    setFields((current) => [...current, next].slice(0, 6));
  }

  function update(id: string, patch: Partial<PersonalizationField>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } as PersonalizationField : field)));
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-4">
      <input type="hidden" name="personalizationJson" value={JSON.stringify(config)} />
      <input type="hidden" name="customProduct" value={enabled ? "1" : "0"} />
      <input type="hidden" name="buyerUpload" value={enabled && fields.some((field) => field.kind === "file") ? "1" : "0"} />
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">Personalization</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Personalization"
          onClick={() => setEnabled((on) => !on)}
          className={`relative h-7 w-12 shrink-0 rounded-full ${enabled ? "bg-forest" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 size-6 rounded-full bg-white ${enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      {enabled ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <p className="text-sm leading-6 text-muted">Choose what buyers need to provide before placing an order.</p>
          {fields.map((field) => (
            <div key={field.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{field.kind === "text" ? "Personalized text" : field.kind === "file" ? "Image or file upload" : field.kind === "choice" ? "Choose from options" : "Additional instructions"}</p>
                <button type="button" className="text-sm text-muted" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>Remove</button>
              </div>
              <label className="mt-3 block text-sm">
                Label
                <input value={field.label} onChange={(event) => update(field.id, { label: event.target.value.slice(0, 40) })} placeholder={field.kind === "text" ? "Name to embroider" : field.kind === "choice" ? "Logo placement" : ""} className={`${inputClass} mt-1`} />
              </label>
              <label className="mt-3 block text-sm">
                Instructions
                <input value={field.help} onChange={(event) => update(field.id, { help: event.target.value.slice(0, 120) })} className={`${inputClass} mt-1`} />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={field.required} onChange={(event) => update(field.id, { required: event.target.checked })} className="h-5 w-5 accent-forest" />
                Required
              </label>
              {field.kind === "text" ? (
                <label className="mt-3 block text-sm">
                  Character limit
                  <input type="number" min={1} max={PERSONALIZATION_TEXT_LIMIT} value={field.maxLength} onChange={(event) => update(field.id, { maxLength: Math.min(PERSONALIZATION_TEXT_LIMIT, Math.max(1, Number(event.target.value) || 1)) })} className={`${inputClass} mt-1`} />
                </label>
              ) : null}
              {field.kind === "file" ? (
                <label className="mt-3 block text-sm">
                  Number of files
                  <input type="number" min={1} max={PERSONALIZATION_FILE_LIMIT} value={field.maxFiles} onChange={(event) => update(field.id, { maxFiles: Math.min(PERSONALIZATION_FILE_LIMIT, Math.max(1, Number(event.target.value) || 1)) })} className={`${inputClass} mt-1`} />
                  <span className="mt-1 block text-muted">{PERSONALIZATION_FILE_HELP} Up to {PERSONALIZATION_FILE_LIMIT} files.</span>
                </label>
              ) : null}
              {field.kind === "choice" ? (
                <div className="mt-3 space-y-2">
                  {field.options.map((option, index) => (
                    <input key={`${field.id}-${index}`} value={option} placeholder={index === 0 ? "Left chest" : "Center chest"} onChange={(event) => update(field.id, { options: field.options.map((item, itemIndex) => itemIndex === index ? event.target.value.slice(0, 40) : item) })} className={inputClass} />
                  ))}
                  {field.options.length < 8 ? (
                    <button type="button" className="text-sm text-forest" onClick={() => update(field.id, { options: [...field.options, ""] })}>Add option</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {fields.length < 6 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => add("text")}>Personalized text</button>
              <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => add("file")}>Image or file upload</button>
              <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => add("choice")}>Choose from options</button>
              <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => add("note")}>Additional instructions</button>
            </div>
          ) : null}
          <label className="flex items-start gap-3 border-t border-line pt-4">
            <input type="checkbox" checked={proof} onChange={(event) => setProof(event.target.checked)} className="mt-1 h-5 w-5 accent-forest" />
            <span>
              Send a proof before production
              <span className="mt-1 block text-sm text-muted">After payment, you send a proof in the order. The buyer approves it or asks for changes.</span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
