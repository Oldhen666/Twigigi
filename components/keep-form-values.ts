"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

export function restoreForm(form: HTMLFormElement, data: FormData) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    if (!element.name || element.disabled) continue;
    if (element instanceof HTMLInputElement && element.type === "file") continue;
    const values = data.getAll(element.name).filter((item): item is string => typeof item === "string");
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = values.includes(element.value);
      continue;
    }
    if (values.length > 0) element.value = values[values.length - 1];
  }
}

export function useKeepFormValues(
  formRef: RefObject<HTMLFormElement | null>,
  state: { error?: string; fieldErrors?: Record<string, string> },
  pending: boolean,
) {
  const draft = useRef<FormData | null>(null);
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || !draft.current) return;
    if (!pending && !state.error && !state.fieldErrors) return;
    restoreForm(form, draft.current);
  }, [formRef, pending, state]);
  return (form: HTMLFormElement) => {
    draft.current = new FormData(form);
  };
}
