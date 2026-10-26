"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import type { FulfillmentOption } from "@/lib/format";
import { formatMoney } from "@/lib/format";
import { methodsForFulfillment } from "@/lib/payments";
import type { Cta, FormState, QuoteForm } from "@/lib/types";
import { PayMethods } from "@/components/pay-methods";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";

type PayDetails = {
  methods: string[];
  cardPaymentUrl: string;
  interacEmail: string;
  venmoUsername: string;
  zelleMode: "phone" | "email";
  zelleContact: string;
};

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function CheckoutForm({
  mode,
  action,
  productId,
  currency,
  priceCents,
  options,
  variantKey = "",
  variantLabel = "",
  requireName = true,
  requirePhone = true,
  quoteForm = null,
  initialQuantity = 1,
  maxQuantity,
  payments = null,
  defaultName = "",
  defaultEmail = "",
}: {
  mode: Cta;
  action: Action;
  productId: string;
  currency: string;
  priceCents: number | null;
  options: FulfillmentOption[];
  variantKey?: string;
  variantLabel?: string;
  requireName?: boolean;
  requirePhone?: boolean;
  quoteForm?: QuoteForm | null;
  initialQuantity?: number;
  maxQuantity?: number;
  payments?: PayDetails | null;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const [fulfillment, setFulfillment] = useState(options[0]?.id ?? "pickup");
  const quantityCap = maxQuantity ?? (mode === "buy" ? 20 : 99);
  const [quantity, setQuantity] = useState(Math.min(Math.max(initialQuantity, 1), Math.max(quantityCap, 1)));
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [hideErrors, setHideErrors] = useState(false);
  function clearAll() {
    formRef.current?.reset();
    setQuantity(Math.min(Math.max(initialQuantity, 1), Math.max(quantityCap, 1)));
    setFulfillment(options[0]?.id ?? "pickup");
    setUploadKey((key) => key + 1);
    setHideErrors(true);
  }
  const selected = options.find((option) => option.id === fulfillment) ?? options[0];
  const total = mode === "buy" && priceCents != null && selected ? priceCents * quantity + selected.feeCents : null;
  const label = mode === "buy" ? "Place order" : mode === "quote" ? "Request quote" : "Send message";
  const payFulfillment = fulfillment === "delivery" || fulfillment === "shipping" ? fulfillment : "pickup";
  const payMethods = payments ? methodsForFulfillment(payments.methods, payFulfillment) : [];
  const fieldErrors = hideErrors || pending ? undefined : state.fieldErrors;
  const formError = hideErrors || pending ? undefined : state.error;
  const needsTransfer = mode === "buy" && payFulfillment !== "pickup" && payMethods.length === 0;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4" onSubmit={() => setHideErrors(false)}>
      <input type="hidden" name="productId" value={productId} />
      {variantKey ? <input type="hidden" name="variant" value={variantKey} /> : null}
      {variantLabel ? <p className="text-sm text-muted">{variantLabel}</p> : null}
      {formError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p> : null}

      {mode !== "buy" || requireName ? (
        <Field label="Name" name="name" required error={fieldErrors?.name}>
          <input name="name" autoComplete="name" aria-required="true" defaultValue={defaultName} className={inputClass} />
        </Field>
      ) : null}
      <Field label="Email" name="email" required error={fieldErrors?.email}>
        <input name="email" type="email" autoComplete="email" aria-required="true" defaultValue={defaultEmail} className={inputClass} />
      </Field>
      {mode !== "buy" || requirePhone ? (
        <Field label="Phone" name="phone" required error={fieldErrors?.phone}>
          <input name="phone" type="tel" autoComplete="tel" aria-required="true" className={inputClass} />
        </Field>
      ) : null}

      {mode !== "contact" && !(mode === "quote" && quoteForm && (quoteForm.items.length > 0 || !quoteForm.askQuantity)) ? (
        <Field label="Quantity" name="quantity" required error={fieldErrors?.quantity}>
          <input
            name="quantity"
            type="number"
            min={1}
            max={quantityCap}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            aria-required="true"
            className={inputClass}
          />
        </Field>
      ) : null}

      {mode === "buy" ? (
        <fieldset>
          <legend className={labelClass}>How do you want it?</legend>
          <div className="space-y-2">
            {options.map((option) => (
              <label key={option.id} className={`block rounded-2xl border px-4 py-3 ${fulfillment === option.id ? "border-forest bg-moss" : "border-line"}`}>
                <input
                  type="radio"
                  name="fulfillment"
                  value={option.id}
                  checked={fulfillment === option.id}
                  onChange={() => setFulfillment(option.id)}
                  className="mr-2"
                />
                <span className="font-medium">{option.label}</span>
                <span className="mt-1 block pl-6 text-sm text-muted">{option.detail}</span>
              </label>
            ))}
          </div>
          {fieldErrors?.fulfillment ? <p className="mt-1 text-sm text-danger">{fieldErrors.fulfillment}</p> : null}
        </fieldset>
      ) : null}

      {mode === "buy" && payments ? (
        <PayMethods
          methods={payMethods}
          cardPaymentUrl={payments.cardPaymentUrl}
          interacEmail={payments.interacEmail}
          venmoUsername={payments.venmoUsername}
          zelleMode={payments.zelleMode}
          zelleContact={payments.zelleContact}
          showContacts
          empty="Delivery and shipping have to be paid by transfer first. This seller has not set one up."
        />
      ) : null}

      {mode === "buy" && fulfillment !== "pickup" ? (
        <Field label="Address" name="address" required error={fieldErrors?.address}>
          <textarea name="address" rows={3} autoComplete="street-address" aria-required="true" className={`${inputClass} h-auto py-3`} />
        </Field>
      ) : null}

      {mode === "quote" && quoteForm ? (
        <>
          {quoteForm.askCompany ? (
            <Field label="Company" name="company" error={fieldErrors?.company}>
              <input name="company" className={inputClass} />
            </Field>
          ) : null}
          {quoteForm.askAddress ? (
            <Field label="Address" name="address" required error={fieldErrors?.address}>
              <textarea name="address" rows={3} aria-required="true" className={`${inputClass} h-auto py-3`} />
            </Field>
          ) : null}
          {quoteForm.items.length > 0 ? (
            <div className="space-y-2">
              <p className={labelClass}>Items</p>
              {quoteForm.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                  <span className="flex-1">{item.description}</span>
                  {quoteForm.askQuantity ? (
                    <input name={`item_${item.id}`} type="number" min={0} max={99} defaultValue={1} aria-label={`${item.description} quantity`} className={`${inputClass} w-20`} />
                  ) : (
                    <input type="hidden" name={`item_${item.id}`} value="1" />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {quoteForm.questions.map((question) => (
            <Field key={question.id} label={question.label} name={question.id} required={question.required} error={fieldErrors?.[question.id]}>
              <textarea name={`question_${question.id}`} rows={3} aria-required={question.required || undefined} className={`${inputClass} h-auto py-3`} />
            </Field>
          ))}
          {quoteForm.questions.length === 0 ? (
            <Field label="Message" name="message" error={fieldErrors?.message}>
              <textarea name="message" rows={3} placeholder="Optional" className={`${inputClass} h-auto py-3`} />
            </Field>
          ) : null}
          {quoteForm.terms ? <p className="text-sm text-muted">{quoteForm.terms}</p> : null}
        </>
      ) : null}

      {mode === "quote" && !quoteForm ? (
        <>
          <Field label="Message" name="message" error={fieldErrors?.message}>
            <textarea name="message" rows={3} placeholder="Optional" className={`${inputClass} h-auto py-3`} />
          </Field>
          <Field label="Project details" name="projectDetails" error={fieldErrors?.projectDetails}>
            <textarea name="projectDetails" rows={4} placeholder="Size, materials, timing — optional" className={`${inputClass} h-auto py-3`} />
          </Field>
        </>
      ) : null}

      {mode === "quote" ? <DocumentUpload key={uploadKey} error={fieldErrors?.documents} /> : null}

      {mode === "contact" ? (
        <Field label="Message" name="message" required error={fieldErrors?.message}>
          <textarea name="message" rows={5} aria-required="true" className={`${inputClass} h-auto py-3`} />
        </Field>
      ) : null}

      {total != null ? <p className="font-serif text-3xl text-forest">{formatMoney(total, currency)}</p> : null}
      {mode === "quote" ? (
        <button type="button" onClick={clearAll} className={`${ghostClass} h-14 w-full rounded-2xl text-lg`}>
          Clear all
        </button>
      ) : null}
      <button disabled={pending || needsTransfer} className={`${buttonClass} h-14 w-full rounded-2xl text-lg`}>
        {pending ? "Sending…" : label}
      </button>
    </form>
  );
}

function DocumentUpload({ error }: { error?: string }) {
  const filesRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  function refresh() {
    setNames([
      ...Array.from(filesRef.current?.files ?? [], (file) => file.name),
      ...Array.from(cameraRef.current?.files ?? [], (file) => file.name),
    ]);
  }
  return (
    <div>
      <span className={labelClass}>Additional documentation</span>
      <input
        ref={filesRef}
        name="documents"
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.pdf,.doc,.docx,image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={refresh}
      />
      <input ref={cameraRef} name="documents" type="file" accept="image/png,image/jpeg" capture="environment" className="sr-only" onChange={refresh} />
      <div className="flex gap-2">
        <button type="button" onClick={() => filesRef.current?.click()} className={`${buttonClass} flex-1`}>
          Gallery
        </button>
        <button type="button" onClick={() => cameraRef.current?.click()} className={`${buttonClass} flex-1`}>
          Camera
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{names.length > 0 ? names.join(", ") : "No file chosen"}</p>
      <p className="mt-1 text-sm text-muted">Gallery or camera. PNG, JPG, Word, or PDF. Up to 4 files, 5 MB each.</p>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  );
}
