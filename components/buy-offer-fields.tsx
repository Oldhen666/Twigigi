"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { centsToInput } from "@/lib/format";
import type { NewPageDraft } from "@/lib/new-page-draft";
import type { Product, ProductOption, ProductVariant } from "@/lib/types";
import { MAX_VALUES, OPTION_NAMES, normalizeVariants, variantLabel } from "@/lib/variants";
import { inputClass, labelClass } from "@/components/ui";
import { CA_PROVINCES, US_STATES, joinLocation, lookupCurrentPlace, lookupIpPlace, splitLocation } from "@/lib/places";
import { parsePaymentMethods, paymentsForCountry } from "@/lib/payments";

function readOptions(seed: NewPageDraft | null, product?: Product): ProductOption[] {
  let saved: ProductOption[] = [];
  if (seed) {
    try {
      saved = JSON.parse(seed.fields.optionsJson || "[]") as ProductOption[];
    } catch {
      saved = [];
    }
  } else {
    saved = product?.options ?? [];
  }
  return OPTION_NAMES.map((name) => ({
    name,
    values: saved.find((item) => item.name.toLowerCase() === name.toLowerCase())?.values.slice(0, MAX_VALUES) ?? [],
  }));
}

function readVariants(seed: NewPageDraft | null, product?: Product): ProductVariant[] {
  if (!seed) return product?.variants ?? [];
  try {
    const parsed = JSON.parse(seed.fields.variantsJson || "[]") as ProductVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BuyOfferFields({
  product,
  errors,
  seed = null,
  onChange,
  digital = false,
}: {
  product?: Product;
  errors?: Record<string, string>;
  seed?: NewPageDraft | null;
  onChange?: () => void;
  digital?: boolean;
}) {
  const seededOptions = readOptions(seed, product);
  const [price, setPrice] = useState(seed?.fields.price ?? centsToInput(product?.priceCents ?? null));
  const [unlimited, setUnlimited] = useState(seed ? seed.fields.quantityMode !== "limited" : product?.quantityAvailable == null);
  const [samePrice, setSamePrice] = useState(seed ? seed.fields.samePrice !== "0" : (product?.samePrice ?? true));
  const [options, setOptions] = useState<ProductOption[]>(seededOptions);
  const [variants, setVariants] = useState<ProductVariant[]>(() => readVariants(seed, product));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(seededOptions.map((option) => [option.name, option.values.length > 0])),
  );
  const [variable, setVariable] = useState(seed ? seed.fields.hasOptions === "1" : Boolean(product?.hasOptions && product.options.some((item) => item.values.length > 0)));
  const [pickup, setPickup] = useState(seed ? (seed.checks.pickupEnabled ?? true) : (product?.pickupEnabled ?? true));
  const [ship, setShip] = useState(seed ? seed.checks.shippingEnabled === true : Boolean(product?.deliveryEnabled || product?.shippingEnabled));
  const initialLocation = seed?.fields.location ?? product?.location ?? "";
  const [payCountry, setPayCountry] = useState(() => splitLocation(initialLocation).country);
  const [methods, setMethods] = useState(() =>
    parsePaymentMethods(seed?.fields.paymentMethods ?? JSON.stringify(product?.paymentMethods ?? []), splitLocation(initialLocation).country),
  );
  const [cardUrl, setCardUrl] = useState(seed?.fields.cardPaymentUrl ?? product?.cardPaymentUrl ?? "");
  const [interacEmail, setInteracEmail] = useState(seed?.fields.interacEmail ?? product?.interacEmail ?? "");
  const [venmoUsername, setVenmoUsername] = useState(seed?.fields.venmoUsername ?? product?.venmoUsername ?? "");
  const [zelleMode, setZelleMode] = useState<"phone" | "email">(() => {
    if (seed) return seed.fields.zelleMode === "email" ? "email" : "phone";
    return product?.zelleMode === "email" ? "email" : "phone";
  });
  const [zelleContact, setZelleContact] = useState(seed?.fields.zelleContact ?? product?.zelleContact ?? "");
  const [deliveryArea, setDeliveryArea] = useState(seed?.fields.shippingNote ?? product?.shippingNote ?? "");
  const [sellerMode, setSellerMode] = useState<"phone" | "email">(() => {
    if (seed) return seed.fields.sellerContactMode === "phone" ? "phone" : "email";
    return product?.sellerContactMode === "phone" ? "phone" : "email";
  });
  const [sellerContact, setSellerContact] = useState(seed?.fields.sellerContact ?? product?.sellerContact ?? "");
  const methodsRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const interacRef = useRef<HTMLInputElement>(null);
  const venmoRef = useRef<HTMLInputElement>(null);
  const zelleRef = useRef<HTMLInputElement>(null);
  const sellerRef = useRef<HTMLInputElement>(null);
  const poke = useRef(false);
  const pokeCard = useRef(false);
  const pokeInterac = useRef(false);
  const pokeVenmo = useRef(false);
  const pokeZelle = useRef(false);
  const notify = useRef(onChange);
  notify.current = onChange;
  const seen = useRef(false);
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    notify.current?.();
  }, [price, unlimited, samePrice, options, variants, enabled, variable, pickup, ship, methods, cardUrl, interacEmail, venmoUsername, zelleContact, zelleMode, deliveryArea, sellerContact, sellerMode]);
  useEffect(() => {
    const allowed = new Set(paymentsForCountry(payCountry).map((method) => method.id));
    setMethods((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [payCountry]);
  useEffect(() => {
    if (!poke.current) return;
    poke.current = false;
    methodsRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    if (pokeCard.current) {
      pokeCard.current = false;
      cardRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (pokeInterac.current) {
      pokeInterac.current = false;
      interacRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (pokeVenmo.current) {
      pokeVenmo.current = false;
      venmoRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (pokeZelle.current) {
      pokeZelle.current = false;
      zelleRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [methods]);
  const zelleModeSeen = useRef(zelleMode);
  useEffect(() => {
    if (zelleModeSeen.current === zelleMode) return;
    zelleModeSeen.current = zelleMode;
    zelleRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [zelleMode]);
  const sellerModeSeen = useRef(sellerMode);
  useEffect(() => {
    if (sellerModeSeen.current === sellerMode) return;
    sellerModeSeen.current = sellerMode;
    sellerRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [sellerMode]);

  function chooseZelle(mode: "phone" | "email") {
    setZelleMode(mode);
    setZelleContact("");
  }

  function chooseSeller(mode: "phone" | "email") {
    setSellerMode(mode);
    setSellerContact("");
  }

  function toggleMethod(id: string) {
    poke.current = true;
    if (id === "card") pokeCard.current = true;
    if (id === "interac") pokeInterac.current = true;
    if (id === "venmo") pokeVenmo.current = true;
    if (id === "zelle") pokeZelle.current = true;
    setMethods((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }
  const baseCents = parseDollars(price) ?? product?.priceCents ?? 0;
  const filled = options.filter((option) => enabled[option.name] && option.values.length > 0);
  const active = variable ? filled : [];
  const rows = normalizeVariants(active, variants, baseCents);
  const needsAddress = ship;

  function updateOptions(next: ProductOption[], nextEnabled = enabled) {
    setOptions(next);
    const active = next.filter((option) => nextEnabled[option.name] && option.values.length > 0);
    setVariants(normalizeVariants(active, variants, baseCents).map((item) => (samePrice ? { ...item, priceCents: baseCents, available: true } : item)));
  }

  function showDifferentPrices() {
    const next = normalizeVariants(filled, variants, baseCents);
    const prices = new Set(next.map((item) => item.priceCents));
    setVariants(prices.size <= 1 ? next.map((item) => ({ ...item, priceCents: baseCents })) : next);
    setSamePrice(false);
  }

  return (
    <section className="mt-8">
      <div className="space-y-4">
        <Field label="price" required error={errors?.price}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink" aria-hidden="true">$</span>
            <input name="price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="129.00 (at least 0.50)" aria-label="price" className={`${inputClass} pl-6`} />
          </div>
        </Field>

        <fieldset>
          <legend className={labelClass}>Quantity available</legend>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="quantityMode" value="unlimited" checked={unlimited} onChange={() => setUnlimited(true)} />
              Unlimited
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="quantityMode" value="limited" checked={!unlimited} onChange={() => setUnlimited(false)} />
              Limited
            </label>
          </div>
          {unlimited ? null : (
            <input
              name="quantityAvailable"
              inputMode="numeric"
              defaultValue={seed?.fields.quantityAvailable ?? product?.quantityAvailable ?? ""}
              placeholder="12 (whole number)"
              className={`${inputClass} mt-3`}
            />
          )}
          {errors?.quantityAvailable ? <p className="mt-1 text-sm text-danger">{errors.quantityAvailable}</p> : null}
        </fieldset>

        <PlaceFields location={initialLocation} error={errors?.location} onCountry={setPayCountry} />

        {digital ? (
          <>
            <input type="hidden" name="hasOptions" value="0" />
            <input type="hidden" name="samePrice" value="1" />
            <input type="hidden" name="optionsJson" value="[]" />
            <input type="hidden" name="variantsJson" value="[]" />
            <p className="text-sm text-muted">There is no pickup or shipping. Twigigi emails the file link and password after you mark the order paid.</p>
          </>
        ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 rounded-full bg-paper-deep p-1">
            <button type="button" onClick={() => setVariable(false)} className={`h-11 rounded-full text-sm font-medium ${variable ? "text-muted" : "bg-forest text-card"}`}>
              Simple product
            </button>
            <button type="button" onClick={() => setVariable(true)} className={`h-11 rounded-full text-sm font-medium ${variable ? "bg-forest text-card" : "text-muted"}`}>
              Variable product
            </button>
          </div>
          <input type="hidden" name="hasOptions" value={active.length > 0 ? "1" : "0"} />
          <input type="hidden" name="samePrice" value={active.length === 0 || samePrice ? "1" : "0"} />
          <input type="hidden" name="optionsJson" value={JSON.stringify(active)} />
          <input type="hidden" name="variantsJson" value={JSON.stringify(active.length > 0 ? rows : [])} />
          {errors?.options ? <p className="mb-3 mt-3 text-sm text-danger">{errors.options}</p> : null}
          {variable ? (
          <div className="mt-4 space-y-4">
            {options.map((option) => (
              <OptionEditor
                key={option.name}
                option={option}
                enabled={Boolean(enabled[option.name])}
                onToggle={(checked) => {
                  const nextEnabled = { ...enabled, [option.name]: checked };
                  setEnabled(nextEnabled);
                  updateOptions(options, nextEnabled);
                }}
                onChange={(next) => updateOptions(options.map((item) => (item.name === option.name ? next : item)))}
              />
            ))}
            {rows.length > 0 ? (
              <label className="flex items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={samePrice}
                  onChange={(event) => {
                    if (event.target.checked) setSamePrice(true);
                    else showDifferentPrices();
                  }}
                  className="h-5 w-5 accent-forest"
                />
                Same price for all options
              </label>
            ) : null}
            {samePrice || rows.length === 0 ? null : (
              <div>
                <p className={labelClass}>Variant prices</p>
                {errors?.variants ? <p className="mb-2 text-sm text-danger">{errors.variants}</p> : null}
                <div className="overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-paper text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Variant</th>
                        <th className="px-3 py-2 font-medium">Price</th>
                        <th className="px-3 py-2 font-medium">Available</th>
                        <th className="px-3 py-2 font-medium">SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="border-t border-line">
                          <td className="px-3 py-2">{variantLabel(row.key)}</td>
                          <td className="px-3 py-2">
                            <PriceCell
                              cents={row.priceCents}
                              onChange={(priceCents) => setVariants(rows.map((item) => (item.key === row.key ? { ...item, priceCents } : item)))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={row.available}
                              onChange={(event) => setVariants(rows.map((item) => (item.key === row.key ? { ...item, available: event.target.checked } : item)))}
                              aria-label={`${variantLabel(row.key)} available`}
                              className="h-5 w-5 accent-forest"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.sku}
                              onChange={(event) => setVariants(rows.map((item) => (item.key === row.key ? { ...item, sku: event.target.value.slice(0, 40) } : item)))}
                              placeholder="Optional"
                              aria-label={`${variantLabel(row.key)} SKU`}
                              className={`${inputClass} h-10`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          ) : null}
        </div>
        )}
      </div>

      {digital ? null : (
      <>
      <h2 className="mt-8 font-serif text-2xl">Delivery Method</h2>
      <div className="mt-4 space-y-3">
        {errors?.fulfillment ? <p className="text-sm text-danger">{errors.fulfillment}</p> : null}
        <div className="rounded-2xl border border-line bg-white p-4">
          <label className="flex items-center gap-3 text-base">
            <input type="checkbox" name="pickupEnabled" checked={pickup} onChange={(event) => setPickup(event.target.checked)} className="h-5 w-5 accent-forest" />
            Local Pickup
          </label>
          {pickup ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Field label="Address" error={errors?.pickupNote}>
                <input name="pickupNote" defaultValue={seed?.fields.pickupNote ?? product?.pickupNote} placeholder="123 Street, Edmonton (street address)" className={inputClass} />
              </Field>
              <PickupTimeField value={seed?.fields.pickupTime ?? product?.pickupTime ?? ""} onChange={onChange} />
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <label className="flex items-center gap-3 text-base">
            <input type="checkbox" name="shippingEnabled" checked={ship} onChange={(event) => setShip(event.target.checked)} className="h-5 w-5 accent-forest" />
            Delivery/Shipping
          </label>
          {ship ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Field label="Fee" error={errors?.shippingFee}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink" aria-hidden="true">$</span>
                  <input name="shippingFee" inputMode="decimal" defaultValue={seed?.fields.shippingFee ?? centsToInput(product?.shippingFeeCents ?? product?.deliveryFeeCents ?? null)} placeholder="0 (optional)" aria-label="Fee" className={`${inputClass} pl-6`} />
                </div>
              </Field>
              <Field label="Delivery area" required error={errors?.shippingNote}>
                <input
                  name="shippingNote"
                  value={deliveryArea}
                  onChange={(event) => setDeliveryArea(event.target.value)}
                  placeholder="Edmonton and nearby (area this fee covers)"
                  className={inputClass}
                />
              </Field>
            </div>
          ) : (
            <input type="hidden" name="shippingNote" value={deliveryArea} />
          )}
        </div>
      </div>
      </>
      )}

      <h2 className="mt-8 font-serif text-2xl">Buyer information required</h2>
      <div className="mt-4 space-y-3">
        <Check name="requireName" defaultChecked={seed ? seed.checks.requireName !== false : (product?.requireName ?? true)} label="Name" />
        <Check name="requireEmail" defaultChecked disabled label="Email" />
        <Check name="requirePhone" defaultChecked={seed ? seed.checks.requirePhone !== false : (product?.requirePhone ?? true)} label="Phone" />
        <p className="text-sm text-muted">
          {digital
            ? "Email is required. The file link and password are sent there after payment."
            : needsAddress
              ? "Address is required when Delivery/Shipping is turned on."
              : "Address is asked only when the buyer chooses Delivery/Shipping."}
        </p>
      </div>

      <div className="mt-8" data-seller-contact>
        <h2 className="font-serif text-2xl">
          Seller contact
          <span className="text-base text-danger"> *</span>
          <span className="ml-1 font-sans text-base font-normal text-muted">Required</span>
        </h2>
        <div className="mt-4 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="sellerContactMode" value="email" checked={sellerMode === "email"} onChange={() => chooseSeller("email")} className="accent-forest" />
              Email
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="sellerContactMode" value="phone" checked={sellerMode === "phone"} onChange={() => chooseSeller("phone")} className="accent-forest" />
              Phone
            </label>
          </div>
          <Field label={sellerMode === "phone" ? "Phone" : "Email"} required error={errors?.sellerContact}>
            <input
              ref={sellerRef}
              name="sellerContact"
              type={sellerMode === "phone" ? "tel" : "email"}
              value={sellerContact}
              onChange={(event) => setSellerContact(event.target.value)}
              placeholder={sellerMode === "phone" ? "5551234567 (phone)" : "name@email.com (email)"}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="mt-8" data-payment-methods>
        <h2 className="font-serif text-2xl">
          How buyers pay
          <span className="text-base text-danger"> *</span>
          <span className="ml-1 font-sans text-base font-normal text-muted">Required</span>
        </h2>
        <PaymentChoices
          country={payCountry}
          methods={methods}
          cardUrl={cardUrl}
          interacEmail={interacEmail}
          venmoUsername={venmoUsername}
          zelleMode={zelleMode}
          zelleContact={zelleContact}
          methodsRef={methodsRef}
          cardRef={cardRef}
          interacRef={interacRef}
          venmoRef={venmoRef}
          zelleRef={zelleRef}
          error={errors?.paymentMethods}
          cardError={errors?.cardPaymentUrl}
          interacError={errors?.interacEmail}
          venmoError={errors?.venmoUsername}
          zelleError={errors?.zelleContact}
          onToggle={toggleMethod}
          onCardUrl={setCardUrl}
          onInteracEmail={setInteracEmail}
          onVenmoUsername={setVenmoUsername}
          onZelleMode={chooseZelle}
          onZelleContact={setZelleContact}
        />
      </div>

    </section>
  );
}

function PaymentChoices({
  country,
  methods,
  cardUrl,
  interacEmail,
  venmoUsername,
  zelleMode,
  zelleContact,
  methodsRef,
  cardRef,
  interacRef,
  venmoRef,
  zelleRef,
  error,
  cardError,
  interacError,
  venmoError,
  zelleError,
  onToggle,
  onCardUrl,
  onInteracEmail,
  onVenmoUsername,
  onZelleMode,
  onZelleContact,
}: {
  country: string;
  methods: string[];
  cardUrl: string;
  interacEmail: string;
  venmoUsername: string;
  zelleMode: "phone" | "email";
  zelleContact: string;
  methodsRef: RefObject<HTMLInputElement | null>;
  cardRef: RefObject<HTMLInputElement | null>;
  interacRef: RefObject<HTMLInputElement | null>;
  venmoRef: RefObject<HTMLInputElement | null>;
  zelleRef: RefObject<HTMLInputElement | null>;
  error?: string;
  cardError?: string;
  interacError?: string;
  venmoError?: string;
  zelleError?: string;
  onToggle: (id: string) => void;
  onCardUrl: (value: string) => void;
  onInteracEmail: (value: string) => void;
  onVenmoUsername: (value: string) => void;
  onZelleMode: (mode: "phone" | "email") => void;
  onZelleContact: (value: string) => void;
}) {
  const choices = paymentsForCountry(country);
  const cardOn = methods.includes("card");
  const interacOn = methods.includes("interac");
  const venmoOn = methods.includes("venmo");
  const zelleOn = methods.includes("zelle");
  return (
    <div className="mt-4 space-y-3">
      {choices.length === 0 ? <p className="text-sm text-muted">Choose a country above to see payment methods.</p> : null}
      {choices.map((method) => (
        <div key={method.id}>
          <label className="flex items-center gap-3 text-base">
            <input type="checkbox" checked={methods.includes(method.id)} onChange={() => onToggle(method.id)} className="h-5 w-5 accent-forest" />
            {method.label}
          </label>
          {method.id === "interac" && interacOn ? (
            <div className="mt-3 pl-8">
              <Field label="Email" required error={interacError}>
                <input
                  ref={interacRef}
                  name="interacEmail"
                  type="email"
                  value={interacEmail}
                  onChange={(event) => onInteracEmail(event.target.value)}
                  placeholder="name@email.com (email)"
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
          {method.id === "venmo" && venmoOn ? (
            <div className="mt-3 pl-8">
              <Field label="Username" required error={venmoError}>
                <input
                  ref={venmoRef}
                  name="venmoUsername"
                  value={venmoUsername}
                  onChange={(event) => onVenmoUsername(event.target.value)}
                  placeholder="@username (Venmo username)"
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
          {method.id === "zelle" && zelleOn ? (
            <div className="mt-3 space-y-3 pl-8">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="zelleMode" value="phone" checked={zelleMode === "phone"} onChange={() => onZelleMode("phone")} className="accent-forest" />
                  Phone
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="zelleMode" value="email" checked={zelleMode === "email"} onChange={() => onZelleMode("email")} className="accent-forest" />
                  Email
                </label>
              </div>
              <Field label={zelleMode === "email" ? "Email" : "Phone"} required error={zelleError}>
                <input
                  ref={zelleRef}
                  name="zelleContact"
                  type={zelleMode === "email" ? "email" : "tel"}
                  value={zelleContact}
                  onChange={(event) => onZelleContact(event.target.value)}
                  placeholder={zelleMode === "email" ? "name@email.com (email)" : "5551234567 (phone)"}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
        </div>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <input ref={methodsRef} type="hidden" name="paymentMethods" value={JSON.stringify(methods)} />
      {interacOn ? null : <input ref={interacRef} type="hidden" name="interacEmail" value={interacEmail} />}
      {venmoOn ? null : <input ref={venmoRef} type="hidden" name="venmoUsername" value={venmoUsername} />}
      {zelleOn ? null : (
        <>
          <input type="hidden" name="zelleMode" value={zelleMode} />
          <input ref={zelleRef} type="hidden" name="zelleContact" value={zelleContact} />
        </>
      )}
      {cardOn ? (
        <Field label="Credit card payment link" required error={cardError}>
          <input
            ref={cardRef}
            name="cardPaymentUrl"
            value={cardUrl}
            onChange={(event) => onCardUrl(event.target.value)}
            placeholder="https://buy.stripe.com/… (http or https)"
            className={inputClass}
          />
          <span className="mt-1 block text-sm text-muted">Paste a Stripe Payment Link, Square link, or PayPal checkout link.</span>
        </Field>
      ) : (
        <input ref={cardRef} type="hidden" name="cardPaymentUrl" value={cardUrl} />
      )}
    </div>
  );
}

function OptionEditor({
  option,
  enabled,
  onToggle,
  onChange,
}: {
  option: ProductOption;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  onChange: (option: ProductOption) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function addValues(raw: string) {
    const parts = raw
      .split(/[,\n·]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const values = [...option.values];
    for (const part of parts) {
      if (values.length >= MAX_VALUES) break;
      if (values.some((value) => value.toLowerCase() === part.toLowerCase())) continue;
      values.push(part.slice(0, 40));
    }
    onChange({ ...option, values });
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <label className="flex items-center gap-3 text-base">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} className="h-5 w-5 accent-forest" />
        {option.name}
      </label>
      {enabled ? (
        <div className="mt-3">
          {option.values.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {option.values.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    onClick={() => onChange({ ...option, values: option.values.filter((item) => item !== value) })}
                    className="rounded-full bg-moss px-3 py-1 text-sm text-forest"
                  >
                    {value} <span aria-hidden="true">×</span>
                    <span className="sr-only">Remove {value}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {adding ? (
            <div>
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addValues(draft);
                  }
                }}
                onBlur={() => {
                  if (draft.trim()) addValues(draft);
                  else setAdding(false);
                }}
                placeholder={option.name === "Color" ? "Black, White" : option.name === "Type" ? "Planter, Bench" : "Small, Medium, Large"}
                aria-describedby={`${option.name}-add-hint`}
                className={inputClass}
              />
              <p id={`${option.name}-add-hint`} className="mt-1.5 text-sm text-muted">Press Enter to add.</p>
            </div>
          ) : option.values.length >= MAX_VALUES ? (
            <p className="text-sm text-muted">5 values maximum</p>
          ) : (
            <button type="button" onClick={() => setAdding(true)} aria-label={`Add ${option.name}`} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-lg text-ink">
              +
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PriceCell({ cents, onChange }: { cents: number; onChange: (cents: number) => void }) {
  const [text, setText] = useState(centsToInput(cents));
  useEffect(() => {
    setText((current) => {
      const parsed = parseDollars(current);
      if (parsed == null || parsed === cents) return current;
      return centsToInput(cents);
    });
  }, [cents]);
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseDollars(next);
        if (parsed != null) onChange(parsed);
      }}
      aria-label="Variant price"
      className={`${inputClass} h-10 w-28`}
    />
  );
}

function parseDollars(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const WEEKEND_NAMES = ["Saturday", "Sunday"] as const;
const DAY_NAMES = [...WEEKDAY_NAMES, ...WEEKEND_NAMES] as const;
const DAY_SHORT: Record<(typeof DAY_NAMES)[number], string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

type TimeMode = "" | "before" | "after" | "between";

type PickupSlot = {
  key: string;
  days: string[];
  mode: TimeMode;
  start: string;
  end: string;
  custom: string;
};

const MAX_PICKUP_TIMES = 3;

function PickupTimeField({ value, onChange }: { value: string; onChange?: () => void }) {
  const [slots, setSlots] = useState<PickupSlot[]>(() => slotsFrom(value));
  const [seq, setSeq] = useState(slots.length + 1);
  const sentence = slots.map(slotSentence).filter(Boolean).join(" | ");
  const notify = useRef(onChange);
  notify.current = onChange;
  const seen = useRef(false);

  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    notify.current?.();
  }, [sentence]);

  function update(key: string, patch: Partial<PickupSlot>) {
    setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch, custom: "" } : slot)));
  }

  function addSlot() {
    const key = `t${seq}`;
    setSeq((current) => current + 1);
    setSlots((current) => (current.length >= MAX_PICKUP_TIMES ? current : [...current, blankSlot(key)]));
  }

  function removeSlot(key: string) {
    setSlots((current) => (current.length === 1 ? current : current.filter((slot) => slot.key !== key)));
  }

  return (
    <div>
      {slots.map((slot, index) => (
        <div key={slot.key} className={index === 0 ? undefined : "mt-4 border-t border-line pt-4"}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Pickup time{slots.length > 1 ? ` ${index + 1}` : ""}</span>
            {slots.length > 1 ? (
              <button type="button" onClick={() => removeSlot(slot.key)} className="text-sm text-danger">
                Remove
              </button>
            ) : null}
          </div>
          <PickupTimeSlot slot={slot} onChange={(patch) => update(slot.key, patch)} />
          {slotSentence(slot) ? <p className="mt-2 text-sm text-muted">{slotSentence(slot)}</p> : null}
        </div>
      ))}
      {slots.length < MAX_PICKUP_TIMES ? (
        <button type="button" onClick={addSlot} className="mt-3 h-10 w-full rounded-xl border border-dashed border-line text-sm text-muted">
          Add pickup time
        </button>
      ) : null}
      <input type="hidden" name="pickupTime" value={sentence} />
    </div>
  );
}

function PickupTimeSlot({ slot, onChange }: { slot: PickupSlot; onChange: (patch: Partial<PickupSlot>) => void }) {
  const weekdaysOn = WEEKDAY_NAMES.every((day) => slot.days.includes(day));
  const weekendsOn = WEEKEND_NAMES.every((day) => slot.days.includes(day));

  function chooseGroup(group: readonly string[]) {
    const allOn = group.every((day) => slot.days.includes(day));
    const next = allOn ? slot.days.filter((day) => !group.includes(day)) : [...slot.days, ...group];
    onChange({ days: DAY_NAMES.filter((day) => next.includes(day)) });
  }

  function chooseDay(day: string) {
    const next = slot.days.includes(day) ? slot.days.filter((item) => item !== day) : [...slot.days, day];
    onChange({ days: DAY_NAMES.filter((item) => next.includes(item)) });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <GroupButton pressed={weekdaysOn} onClick={() => chooseGroup(WEEKDAY_NAMES)}>Weekdays</GroupButton>
        <GroupButton pressed={weekendsOn} onClick={() => chooseGroup(WEEKEND_NAMES)}>Weekends</GroupButton>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((day) => (
          <button
            key={day}
            type="button"
            aria-label={day}
            aria-pressed={slot.days.includes(day)}
            onClick={() => chooseDay(day)}
            className={`h-10 rounded-xl text-xs font-medium sm:text-sm ${slot.days.includes(day) ? "bg-forest text-card" : "border border-line bg-white text-ink"}`}
          >
            {DAY_SHORT[day]}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-paper-deep p-1">
        {(["before", "after", "between"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={slot.mode === item}
            onClick={() => onChange({ mode: slot.mode === item ? "" : item })}
            className={`h-10 rounded-full text-sm font-medium ${slot.mode === item ? "bg-forest text-card" : "text-muted"}`}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {slot.mode ? (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="time"
            aria-label={slot.mode === "between" ? "From" : slot.mode === "before" ? "Before" : "After"}
            value={slot.start}
            onChange={(event) => onChange({ start: event.target.value })}
            className={inputClass}
          />
          <span className={`text-sm text-muted ${slot.mode === "between" ? "" : "invisible"}`}>to</span>
          <input
            type="time"
            aria-label="To"
            value={slot.end}
            disabled={slot.mode !== "between"}
            onChange={(event) => onChange({ end: event.target.value })}
            className={`${inputClass} ${slot.mode === "between" ? "" : "invisible"}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function blankSlot(key: string): PickupSlot {
  return { key, days: [], mode: "", start: "", end: "", custom: "" };
}

function slotsFrom(value: string): PickupSlot[] {
  const parts = value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_PICKUP_TIMES);
  if (parts.length === 0) return [blankSlot("t1")];
  return parts.map((part, index) => ({ key: `t${index + 1}`, ...parsePickupTime(part) }));
}

function slotSentence(slot: PickupSlot) {
  return slot.custom || composePickupTime(slot.days, slot.mode, slot.start, slot.end);
}

function GroupButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`h-10 rounded-xl border text-sm font-medium ${pressed ? "border-forest bg-forest text-card" : "border-line bg-white text-ink"}`}>
      {children}
    </button>
  );
}

function composePickupTime(days: string[], mode: TimeMode, start: string, end: string) {
  const parts: string[] = [];
  const phrase = dayPhrase(days);
  if (phrase) parts.push(phrase);
  const from = formatClock(start);
  const to = formatClock(end);
  if (mode === "before" && from) parts.push(`before ${from}`);
  if (mode === "after" && from) parts.push(`after ${from}`);
  if (mode === "between" && from && to) parts.push(`between ${from} and ${to}`);
  return parts.join(", ");
}

function dayPhrase(days: string[]) {
  const week = WEEKDAY_NAMES.every((day) => days.includes(day));
  const end = WEEKEND_NAMES.every((day) => days.includes(day));
  if (week && end) return "Every day";
  const parts: string[] = [];
  if (week) parts.push("Weekdays");
  else parts.push(...WEEKDAY_NAMES.filter((day) => days.includes(day)));
  if (end) parts.push("Weekends");
  else parts.push(...WEEKEND_NAMES.filter((day) => days.includes(day)));
  return parts.join(", ");
}

function parsePickupTime(value: string) {
  const trimmed = value.trim();
  const empty = { days: [] as string[], mode: "" as TimeMode, start: "", end: "", custom: "" };
  if (!trimmed) return empty;
  let rest = trimmed;
  let mode: TimeMode = "";
  let start = "";
  let end = "";
  const between = rest.match(/,\s*between\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+and\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const before = rest.match(/,\s*before\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const after = rest.match(/,\s*after\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*$/i);
  const range = rest.match(/,\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*(AM|PM)?\s*$/i);
  const hit = between ?? before ?? after ?? range;
  if (between) {
    mode = "between";
    start = to24(between[1]);
    end = to24(between[2]);
  } else if (before) {
    mode = "before";
    start = to24(before[1]);
  } else if (after) {
    mode = "after";
    start = to24(after[1]);
  } else if (range) {
    mode = "between";
    const suffix = range[3] ?? "";
    start = to24(`${range[1]} ${suffix}`.trim());
    end = to24(`${range[2]} ${suffix}`.trim());
  }
  if (hit?.index != null) rest = rest.slice(0, hit.index).trim();
  const days = expandDays(rest);
  if (!days) return { ...empty, custom: trimmed };
  if ((mode === "before" || mode === "after") && !start) return { ...empty, custom: trimmed };
  if (mode === "between" && (!start || !end)) return { ...empty, custom: trimmed };
  return { days, mode, start, end, custom: "" };
}

function expandDays(value: string) {
  if (!value) return [] as string[];
  const known = new Map<string, readonly string[]>([
    ["every day", DAY_NAMES],
    ["weekdays", WEEKDAY_NAMES],
    ["weekends", WEEKEND_NAMES],
    ...DAY_NAMES.map((day) => [day.toLowerCase(), [day]] as const),
  ]);
  const selected = new Set<string>();
  for (const token of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const days = known.get(token.toLowerCase());
    if (!days) return null;
    days.forEach((day) => selected.add(day));
  }
  return DAY_NAMES.filter((day) => selected.has(day));
}

function formatClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (hour24 > 23) return "";
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function to24(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return "";
  let hour = Number(match[1]);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  if (hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function PlaceFields({ location, error, onCountry }: { location?: string; error?: string; onCountry?: (country: string) => void }) {
  const parsed = splitLocation(location ?? "");
  const [city, setCity] = useState(parsed.city);
  const [country, setCountry] = useState(parsed.country);
  const [province, setProvince] = useState(parsed.province);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const hiddenRef = useRef<HTMLInputElement>(null);
  const seen = useRef(false);
  const provinces = country === "US" ? US_STATES : country === "CA" ? CA_PROVINCES : {};
  const joined = joinLocation(city, provinces[province] ?? "", country);

  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [joined]);

  useEffect(() => {
    onCountry?.(country);
  }, [country, onCountry]);

  useEffect(() => {
    if (parsed.city || parsed.country) return;
    let cancel = false;
    lookupIpPlace()
      .then((place) => {
        if (cancel) return;
        setCountry(place.country);
        setProvince(place.province);
        setCity(place.city);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [parsed.city, parsed.country]);

  async function locate() {
    setLocating(true);
    setLocateError("");
    try {
      const place = await lookupCurrentPlace();
      setCountry(place.country);
      setProvince(place.province);
      setCity(place.city);
    } catch (reason) {
      setLocateError(reason instanceof Error ? reason.message : "Could not find this location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>
          Location
          <span className="text-danger"> *</span>
          <span className="ml-1 font-normal text-muted"> Required</span>
        </span>
        <button type="button" onClick={locate} disabled={locating} className="text-sm text-forest disabled:opacity-60">
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <label className="mt-3 block">
        <span className={labelClass}>Country</span>
        <select
          value={country}
          onChange={(event) => {
            const next = event.target.value;
            setCountry(next);
            if (!(next === "US" ? US_STATES : CA_PROVINCES)[province]) setProvince("");
          }}
          aria-label="Country"
          className={inputClass}
        >
          {country ? null : <option value="" hidden />}
          <option value="CA">Canada</option>
          <option value="US">United States</option>
        </select>
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>Province</span>
        <select value={provinces[province] ? province : ""} disabled={!country} onChange={(event) => setProvince(event.target.value)} aria-label="Province" className={inputClass}>
          <option value="">Province</option>
          {Object.entries(provinces).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>City or town</span>
        <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Edmonton (city or town)" aria-label="City or town" className={inputClass} />
      </label>
      <input ref={hiddenRef} type="hidden" name="location" value={joined} />
      {locateError ? <span className="mt-1 block text-sm text-danger">{locateError}</span> : null}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </div>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      {label ? (
        <span className={labelClass}>
          {label}
          {required ? (
            <>
              <span className="text-danger"> *</span>
              <span className="ml-1 font-normal text-muted"> Required</span>
            </>
          ) : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  );
}

function Check({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-base">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="h-5 w-5 accent-forest" />
      {label}
    </label>
  );
}
