"use client";

import { useEffect, useRef, useState } from "react";
import { blankQuoteForm } from "@/lib/quote-form";
import type { QuoteForm } from "@/lib/types";
import { ghostClass, inputClass } from "@/components/ui";

const MAX_FIELDS = 8;
const MAX_CHOICES = 12;

export function QuoteFormFields({ value, onChange }: { value?: QuoteForm | null; onChange?: () => void }) {
  const [form, setForm] = useState<QuoteForm>(() => editorForm(value));
  const [seq, setSeq] = useState(20);
  const ready = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    onChangeRef.current?.();
  }, [form]);

  function nextId() {
    const id = `q-${seq}`;
    setSeq((current) => current + 1);
    return id;
  }

  function updateQuestion(id: string, patch: Partial<QuoteForm["questions"][number]>) {
    setForm({
      ...form,
      questions: form.questions.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }

  const saved = { ...form, items: [], terms: "" };

  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">Quotation Form</h2>
      <p className="mt-2 text-sm text-muted">This is the form customers fill in when they request a quote.</p>
      <input type="hidden" name="quoteFormJson" value={JSON.stringify(saved)} />

      <div className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-medium">Customer</p>
        <Check label="Name" checked={form.askName} onChange={(askName) => setForm({ ...form, askName })} />
        <Check label="Email" checked disabled onChange={() => undefined} />
        <Check label="Phone" checked={form.askPhone} onChange={(askPhone) => setForm({ ...form, askPhone })} />
        <Check label="Company" checked={form.askCompany} onChange={(askCompany) => setForm({ ...form, askCompany })} />
        <Check label="Address" checked={form.askAddress} onChange={(askAddress) => setForm({ ...form, askAddress })} />
        <Check label="Quantity" checked={form.askQuantity} onChange={(askQuantity) => setForm({ ...form, askQuantity })} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-medium">Custom field (What should the customer answer?)</p>
        <div className="mt-3 space-y-3">
          {form.questions.map((question, index) => (
            <div key={question.id} className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2">
                <input
                  value={question.label}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      questions: form.questions.map((row) => (row.id === question.id ? { ...row, label: event.target.value.slice(0, 120) } : row)),
                    })
                  }
                  placeholder={index === 0 ? "Can you describe the scope of your work?" : "custom field *"}
                  aria-label="Custom field"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, questions: form.questions.filter((row) => row.id !== question.id) })}
                  className="shrink-0 text-sm text-danger"
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                    className="h-5 w-5 accent-forest"
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={question.answer === "checks"}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        answer: event.target.checked ? "checks" : "text",
                        choices: event.target.checked ? (question.choices.length > 0 ? question.choices : [""]) : [],
                      })
                    }
                    className="h-5 w-5 accent-forest"
                  />
                  Checkbox answers
                </label>
              </div>
              {question.answer === "checks" ? (
                <div className="space-y-2 pl-1">
                  {question.choices.map((choice, choiceIndex) => (
                    <div key={`${question.id}-${choiceIndex}`} className="flex items-center gap-2">
                      <input type="checkbox" disabled className="h-5 w-5 accent-forest" />
                      <input
                        value={choice}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            choices: question.choices.map((row, rowIndex) => (rowIndex === choiceIndex ? event.target.value.slice(0, 80) : row)),
                          })
                        }
                        placeholder="Option"
                        aria-label={`Option ${choiceIndex + 1}`}
                        className={inputClass}
                      />
                      {question.choices.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { choices: question.choices.filter((_, rowIndex) => rowIndex !== choiceIndex) })}
                          className="shrink-0 text-sm text-danger"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {question.choices.length < MAX_CHOICES ? (
                    <button
                      type="button"
                      onClick={() => updateQuestion(question.id, { choices: [...question.choices, ""] })}
                      className="text-sm text-forest"
                    >
                      Add new
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {form.questions.length < MAX_FIELDS ? (
          <button
            type="button"
            onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion(nextId())] })}
            className={`${ghostClass} mt-3 w-full bg-card`}
          >
            Add field
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-medium">Additional documentation</p>
        <p className="mt-1 text-sm text-muted">Customers can choose a photo from their gallery, take one with the camera, or attach a PNG, JPG, Word, or PDF file. Up to 4 files, 5 MB each.</p>
      </div>
    </section>
  );
}

function editorForm(value?: QuoteForm | null): QuoteForm {
  const base = value ?? blankQuoteForm();
  return {
    ...base,
    items: [],
    terms: "",
    questions: base.questions.length > 0 ? base.questions.map(readyQuestion) : [blankQuestion("q-1")],
  };
}

function blankQuestion(id: string): QuoteForm["questions"][number] {
  return { id, label: "", required: false, answer: "text", choices: [] };
}

function readyQuestion(question: QuoteForm["questions"][number]): QuoteForm["questions"][number] {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  return {
    id: question.id,
    label: question.label,
    required: question.required === true,
    answer: question.answer === "checks" ? "checks" : "text",
    choices: question.answer === "checks" ? (choices.length > 0 ? choices : [""]) : [],
  };
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-base">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-forest"
      />
      {label}
    </label>
  );
}
