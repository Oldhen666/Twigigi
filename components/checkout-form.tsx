"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useKeepFormValues } from "@/components/keep-form-values";
import type { FulfillmentOption } from "@/lib/format";
import { formatFeeRate, platformOrderFeeCents } from "@/lib/digital-plans";
import { formatMoney, shippingCharge } from "@/lib/format";
import { methodsForFulfillment, isCashMethod } from "@/lib/payments";
import type { Cta, FormState, QuoteForm } from "@/lib/types";
import { PayChoice, PickupFacts } from "@/components/checkout-choices";
import { PaymentRiskNote } from "@/components/payment-risk";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { legacyUploadPersonalization, PERSONALIZATION_FILE_ACCEPT, PERSONALIZATION_FILE_HELP, type PersonalizationConfig } from "@/lib/personalization";

type PayDetails = {
  methods: string[];
  cardPaymentUrl: string;
  interacEmail: string;
  interacQuestion?: string;
  interacPassword?: string;
  venmoUsername: string;
  paypalMe?: string;
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
  buyerUpload = false,
  personalization = null,
  fileFeeBps = 0,
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
  buyerUpload?: boolean;
  personalization?: PersonalizationConfig | null;
  fileFeeBps?: number;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const [fulfillment, setFulfillment] = useState(options[0]?.id ?? "pickup");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const paying = mode === "buy" || mode === "file";
  const quantityCap = maxQuantity ?? (paying ? 20 : 99);
  const [quantity, setQuantity] = useState(Math.min(Math.max(initialQuantity, 1), Math.max(quantityCap, 1)));
  const formRef = useRef<HTMLFormElement>(null);
  const riskSeen = useRef(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [hideErrors, setHideErrors] = useState(false);
  const rememberForm = useKeepFormValues(formRef, state, pending);
  function clearAll() {
    formRef.current?.reset();
    setQuantity(Math.min(Math.max(initialQuantity, 1), Math.max(quantityCap, 1)));
    setFulfillment(options[0]?.id ?? "pickup");
    setPaymentMethod("");
    setPickupTime("");
    setUploadKey((key) => key + 1);
    setHideErrors(true);
  }
  const selected = options.find((option) => option.id === fulfillment) ?? options[0];
  const merchandise = paying && priceCents != null ? priceCents * quantity : 0;
  const baseFee = mode === "file" ? 0 : selected?.feeCents ?? 0;
  const fee = mode === "file" ? 0 : shippingCharge(merchandise, baseFee, selected?.freeOverCents);
  const shippingWaived = mode === "buy" && baseFee > 0 && fee === 0;
  const total = paying && priceCents != null && (mode === "file" || selected) ? merchandise + fee : null;
  const label = mode === "file" ? "Continue to payment" : paying ? "Place order" : mode === "quote" ? "Request quote" : "Send message";
  const payFulfillment = mode === "file" || !(fulfillment === "delivery" || fulfillment === "shipping") ? "pickup" : fulfillment;
  const payMethods = payments ? methodsForFulfillment(payments.methods, payFulfillment) : [];
  const methodKey = payMethods.join("|");
  useEffect(() => {
    setPaymentMethod((current) => (payMethods.length === 1 ? payMethods[0] : payMethods.includes(current) ? current : ""));
  }, [methodKey]);
  useEffect(() => {
    if (selected?.id !== "pickup") setPickupTime("");
  }, [selected?.id]);
  const [riskOpen, setRiskOpen] = useState(false);
  const cashPay = paymentMethod === "cash" || paymentMethod === "cash_pickup";
  const fieldErrors = hideErrors || pending ? undefined : state.fieldErrors;
  const formError = hideErrors || pending ? undefined : state.error;
  const needsTransfer = mode === "buy" && payFulfillment !== "pickup" && payMethods.length === 0;
  const config = useMemo(() => (
    personalization && personalization.enabled && (personalization.fields.length > 0 || personalization.proof)
      ? personalization
      : buyerUpload
        ? legacyUploadPersonalization()
        : null
  ), [personalization, buyerUpload]);
  const steps = config ? ["details", config.fields.length > 0 ? "personal" : "", "delivery", "review"].filter(Boolean) : [];
  const [step, setStep] = useState(steps[0] ?? "details");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const [fileKeys, setFileKeys] = useState<Record<string, number>>({});
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!config || !state.fieldErrors) return;
    const keys = Object.keys(state.fieldErrors);
    if (keys.some((key) => key === "name" || key === "email" || key === "phone" || key === "quantity")) setStep("details");
    else if (config.fields.some((field) => keys.includes(field.id))) setStep("personal");
    else if (keys.some((key) => key === "fulfillment" || key === "pickupTime" || key === "address" || key === "deliveryNote")) setStep("delivery");
    else if (keys.includes("paymentMethod")) setStep("review");
    setFileNames((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of config.fields) {
        if (field.kind !== "file" || !state.fieldErrors?.[field.id]) continue;
        const input = formRef.current?.elements.namedItem(`pFile_${field.id}`);
        const attached = input instanceof HTMLInputElement && input.files ? input.files.length : 0;
        if (attached > 0 || (next[field.id] ?? []).length === 0) continue;
        next[field.id] = [];
        changed = true;
      }
      return changed ? next : current;
    });
  }, [state.fieldErrors, config]);
  function goNext() {
    if (step === "personal" && config) {
      const errors: Record<string, string> = {};
      for (const field of config.fields) {
        if (!field.required) continue;
        if (field.kind === "file" && (fileNames[field.id] ?? []).length < 1) errors[field.id] = `Add ${field.label}.`;
        if (field.kind !== "file" && !(answers[field.id] ?? "").trim()) errors[field.id] = field.kind === "choice" ? `Choose ${field.label}.` : `Enter ${field.label}.`;
      }
      setLocalErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    setStep(steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)] ?? "review");
  }
  const reviewLine = [variantLabel.replaceAll(" / ", " · "), ...(config?.fields ?? []).filter((field) => field.kind !== "file" && field.kind !== "note").map((field) => answers[field.id]).filter(Boolean)].filter(Boolean).join(" · ");

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        setHideErrors(false);
        rememberForm(event.currentTarget);
        if (mode === "buy" && paymentMethod && !riskSeen.current) {
          event.preventDefault();
          setRiskOpen(true);
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      {variantKey ? <input type="hidden" name="variant" value={variantKey} /> : null}
      {variantLabel ? <p className="text-sm text-muted">{variantLabel}</p> : null}
      {formError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p> : null}
      {config ? <p className="text-sm text-muted">{step === "details" ? "Options and quantity" : step === "personal" ? "Personalization" : step === "delivery" ? "Delivery" : "Review and pay"}</p> : null}

      <div className={config && step !== "details" ? "hidden space-y-4" : "space-y-4"}>
      {(mode !== "buy" && mode !== "file") || requireName ? (
        <Field label="Name" name="name" required error={fieldErrors?.name}>
          <input name="name" autoComplete="name" aria-required="true" defaultValue={defaultName} className={inputClass} />
        </Field>
      ) : null}
      <Field label="Email" name="email" required error={fieldErrors?.email}>
        <input name="email" type="email" autoComplete="email" aria-required="true" defaultValue={defaultEmail} className={inputClass} />
        {mode === "file" ? <span className="mt-1 block text-sm font-normal text-muted">This email receives the file link and password.</span> : null}
      </Field>
      {(mode !== "buy" && mode !== "file") || requirePhone ? (
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
      </div>

      {config && config.fields.length > 0 ? (
        <div className={step === "personal" ? "space-y-4" : "hidden"}>
          {config.fields.map((field) => {
            const error = fieldErrors?.[field.id] || localErrors[field.id];
            if (field.kind === "file") {
              return (
                <div key={field.id}>
                  <span className={labelClass}>{field.label}{field.required ? <span className="text-danger"> *</span> : null}</span>
                  <input
                    key={`${field.id}-${fileKeys[field.id] ?? 0}`}
                    name={`pFile_${field.id}`}
                    type="file"
                    accept={PERSONALIZATION_FILE_ACCEPT}
                    multiple={field.maxFiles > 1}
                    className={`${inputClass} py-2`}
                    onChange={(event) => {
                      const names = Array.from(event.target.files ?? []).slice(0, field.maxFiles).map((file) => file.name);
                      setFileNames((current) => ({ ...current, [field.id]: names }));
                      setLocalErrors((current) => ({ ...current, [field.id]: "" }));
                    }}
                  />
                  <span className="mt-1 block text-sm text-muted">{field.help || "Add the file for this order."} {PERSONALIZATION_FILE_HELP} Up to {field.maxFiles}.</span>
                  {(fileNames[field.id] ?? []).map((name) => <span key={name} className="mt-1 block text-sm">{name}</span>)}
                  {(fileNames[field.id] ?? []).length > 0 ? (
                    <button type="button" className="mt-2 text-sm text-forest" onClick={() => { setFileKeys((current) => ({ ...current, [field.id]: (current[field.id] ?? 0) + 1 })); setFileNames((current) => ({ ...current, [field.id]: [] })); }}>Remove</button>
                  ) : null}
                  {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
                </div>
              );
            }
            if (field.kind === "choice") {
              return (
                <fieldset key={field.id}>
                  <legend className={labelClass}>{field.label}{field.required ? <span className="text-danger"> *</span> : null}</legend>
                  {field.help ? <p className="mb-2 text-sm text-muted">{field.help}</p> : null}
                  <div className="space-y-2">
                    {field.options.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`p_${field.id}`} value={option} checked={answers[field.id] === option} onChange={() => { setAnswers((current) => ({ ...current, [field.id]: option })); setLocalErrors((current) => ({ ...current, [field.id]: "" })); }} />
                        {option}
                      </label>
                    ))}
                  </div>
                  {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
                </fieldset>
              );
            }
            return (
              <Field key={field.id} label={field.label} name={field.id} required={field.required} error={error}>
                {field.kind === "note" ? (
                  <textarea name={`p_${field.id}`} rows={3} maxLength={400} defaultValue={answers[field.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.help} className={`${inputClass} h-auto py-3`} />
                ) : (
                  <input name={`p_${field.id}`} maxLength={field.maxLength} defaultValue={answers[field.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.help} className={inputClass} />
                )}
                {field.kind === "text" ? <span className="mt-1 block text-sm font-normal text-muted">Up to {field.maxLength} characters.</span> : null}
              </Field>
            );
          })}
        </div>
      ) : null}

      <div className={config && step !== "delivery" ? "hidden space-y-4" : "space-y-4"}>
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
                {option.id === "pickup" ? null : option.detail ? <span className="mt-1 block pl-6 text-sm text-muted">{option.detail}</span> : null}
                {fulfillment === option.id && option.id === "pickup" ? (
                  <PickupFacts
                    location={option.location ?? ""}
                    schedules={[option.schedule ?? ""]}
                    summary={option.times ?? []}
                    selectedTime={pickupTime}
                    onTime={setPickupTime}
                    error={fieldErrors?.pickupTime}
                  />
                ) : null}
              </label>
            ))}
          </div>
          {fieldErrors?.fulfillment ? <p className="mt-1 text-sm text-danger">{fieldErrors.fulfillment}</p> : null}
        </fieldset>
      ) : null}
      {mode === "buy" && fulfillment !== "pickup" ? (
        <>
          <Field label="Address" name="address" required error={fieldErrors?.address}>
            <textarea name="address" rows={3} autoComplete="street-address" aria-required="true" className={`${inputClass} h-auto py-3`} />
          </Field>
          {fulfillment === "shipping" ? (
            <Field label="Delivery instructions (optional)" name="deliveryNote" error={fieldErrors?.deliveryNote}>
              <input name="deliveryNote" maxLength={200} placeholder="Gate code, buzzer, where to leave it" className={inputClass} />
            </Field>
          ) : null}
        </>
      ) : null}
      </div>

      {config && step === "review" ? (
        <div className="rounded-2xl border border-line bg-white p-4 text-sm leading-6">
          {reviewLine ? <p>{reviewLine}</p> : null}
          {config.fields.filter((field) => field.kind === "file").flatMap((field) => (fileNames[field.id] ?? []).map((name) => <p key={`${field.id}-${name}`}>{field.label}: {name}</p>))}
          {config.fields.filter((field) => field.kind === "note" && answers[field.id]).map((field) => <p key={field.id}>{field.label}: {answers[field.id]}</p>)}
          {config.fields.length > 0 ? <button type="button" className="mt-2 text-forest" onClick={() => setStep("personal")}>Edit personalization</button> : null}
          {config.proof ? <p className="mt-3 text-muted">You’ll receive a proof to approve before we start making your item.</p> : null}
        </div>
      ) : null}

      <div className={config && step !== "review" ? "hidden space-y-4" : "space-y-4"}>
      {(mode === "file" || mode === "buy") && payments ? (
        <PayChoice
          methods={payMethods}
          selected={paymentMethod}
          onSelect={setPaymentMethod}
          cardPaymentUrl={mode === "file" ? "" : payments.cardPaymentUrl}
          interacEmail={payments.interacEmail}
          interacQuestion={payments.interacQuestion}
          interacPassword={payments.interacPassword}
          venmoUsername={payments.venmoUsername}
          paypalMe={payments.paypalMe ?? ""}
          amountCents={total ?? 0}
          currency={currency}
          error={fieldErrors?.paymentMethod}
          empty={needsTransfer ? "Delivery and shipping have to be paid by transfer first. This seller has not set one up." : ""}
          showPayLink={false}
        />
      ) : null}
      {mode === "buy" && needsTransfer ? <p className="text-sm text-danger">Delivery and shipping have to be paid by transfer first. This seller has not set one up.</p> : null}
      {mode === "file" ? <p className="text-sm text-muted">Next you pay the seller. The file is emailed as soon as the payment is confirmed.</p> : null}

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
          {quoteForm.questions.map((question) =>
            question.answer === "checks" ? (
              <fieldset key={question.id}>
                <legend className={labelClass}>
                  {question.label}
                  {question.required ? <span className="text-danger"> *</span> : null}
                </legend>
                <div className="space-y-2">
                  {question.choices.map((choice) => (
                    <label key={`${question.id}-${choice}`} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`question_${question.id}`} value={choice} className="h-5 w-5 accent-forest" />
                      {choice}
                    </label>
                  ))}
                </div>
                {fieldErrors?.[question.id] ? <p className="mt-1 text-sm text-danger">{fieldErrors[question.id]}</p> : null}
              </fieldset>
            ) : (
              <Field key={question.id} label={question.label} name={question.id} required={question.required} error={fieldErrors?.[question.id]}>
                <textarea name={`question_${question.id}`} rows={3} aria-required={question.required || undefined} className={`${inputClass} h-auto py-3`} />
              </Field>
            ),
          )}
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
      {mode === "file" && total != null ? (
        <div className="space-y-1 text-sm leading-6 text-muted">
          <p>You pay the seller {formatMoney(total, currency)}. Twigigi does not add its fee to that amount.</p>
          {fileFeeBps > 0 ? (
            <p>Twigigi platform fee {formatFeeRate(fileFeeBps)}: {formatMoney(platformOrderFeeCents(total, fileFeeBps), "CAD")}. Stripe or PayPal payment processing fees are separate and are not this platform fee.</p>
          ) : (
            <p>No Twigigi platform fee applies to this order. Stripe or PayPal may still charge their own payment processing fee.</p>
          )}
        </div>
      ) : null}
      {shippingWaived ? <p className="-mt-2 text-sm text-muted">Shipping is free on this order.</p> : null}
      {mode === "quote" ? (
        <button type="button" onClick={clearAll} className={`${ghostClass} h-14 w-full rounded-2xl text-lg`}>
          Clear all
        </button>
      ) : null}
      </div>
      {config && step !== "review" ? (
        <div className="flex gap-2">
          {step !== "details" ? <button type="button" onClick={() => setStep(steps[Math.max(steps.indexOf(step) - 1, 0)] ?? "details")} className={`${ghostClass} h-14 flex-1 rounded-2xl text-lg`}>Back</button> : null}
          <button type="button" onClick={goNext} className={`${buttonClass} h-14 flex-1 rounded-2xl text-lg`}>Continue</button>
        </div>
      ) : (
      <button disabled={pending || needsTransfer} className={`${buttonClass} h-14 w-full rounded-2xl text-lg`}>
        {pending ? "Sending…" : label}
      </button>
      )}
      {riskOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setRiskOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pay-risk-title" className="w-full max-w-md rounded-[28px] bg-card p-5" onClick={(event) => event.stopPropagation()}>
            <h2 id="pay-risk-title" className="font-serif text-3xl">Pay the seller directly</h2>
            <div className="mt-3">
              <PaymentRiskNote cash={cashPay} />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setRiskOpen(false)} className={`${ghostClass} flex-1`}>Back</button>
              <button
                type="button"
                className={`${buttonClass} flex-1`}
                onClick={() => {
                  riskSeen.current = true;
                  setRiskOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                Place order
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          Upload
        </button>
        <button type="button" onClick={() => cameraRef.current?.click()} className={`${buttonClass} flex-1`}>
          Camera
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{names.length > 0 ? names.join(", ") : "No file chosen"}</p>
      <p className="mt-1 text-sm text-muted">Upload or camera. PNG, JPG, Word, or PDF. Up to 4 files, 5 MB each.</p>
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
