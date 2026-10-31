"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { captureDraft, readDraftImage, type DraftImage, type NewPageDraft } from "@/lib/new-page-draft";
import type { Cta, FormState, Product, QuoteForm } from "@/lib/types";
import { BuyOfferFields } from "@/components/buy-offer-fields";
import { CategoryFields } from "@/components/category-fields";
import { FileLinkFields } from "@/components/file-link-fields";
import { PagePreview, readPagePreview, type PagePreviewDraft } from "@/components/page-preview";
import { PublishAccount } from "@/components/publish-account";
import { QuoteFormFields } from "@/components/quote-form-fields";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { categoryProblem } from "@/lib/categories";
import { parseFileLinks } from "@/lib/files";
import { PROVINCES, joinLocation, lookupCurrentPlace, placeProblem, splitLocation } from "@/lib/places";
import { cardLinkProblem, interacEmailProblem, isTransferMethod, parsePaymentMethods, sellerContactProblem, venmoUsernameProblem, zelleContactProblem } from "@/lib/payments";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function ProductForm({
  action,
  product,
  defaultEmail,
  cta,
  sellerName,
  guest = false,
  needsUsername = false,
}: {
  action: Action;
  product?: Product;
  defaultEmail: string;
  cta: Cta;
  sellerName: string;
  guest?: boolean;
  needsUsername?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const refreshRef = useRef<(form: HTMLFormElement) => void>(() => {});
  const restoredFiles = useRef<File[]>([]);
  const imageDraft = useRef<DraftImage[]>([]);
  const latest = useRef<NewPageDraft | null>(null);
  const savedRecord = useRef<{ productId?: string; slug?: string; savedImages?: string[] }>({
    productId: product?.id,
    slug: product?.slug,
    savedImages: product?.images,
  });
  const seenSave = useRef(0);
  const skipSave = useRef(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    for (const file of restoredFiles.current) formData.append("images", file);
    return action(prev, formData);
  }, {} as FormState);
  const [kept, setKept] = useState<string[]>(product?.images ?? []);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PagePreviewDraft | null>(null);
  const [draft, setDraft] = useState<NewPageDraft | null>(null);
  const [savedId, setSavedId] = useState(product?.id ?? "");
  const [savedSlug, setSavedSlug] = useState(product?.slug ?? "");
  const [notice, setNotice] = useState<"saved" | null>(null);
  const [accountIntent, setAccountIntent] = useState<"draft" | "publish">("publish");
  const [confirmClear, setConfirmClear] = useState(false);
  const [seller, setSeller] = useState(sellerName);
  const [needsAccount, setNeedsAccount] = useState(guest);
  const [accountOpen, setAccountOpen] = useState(false);
  const [ready] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [live, setLive] = useState<Record<string, string>>({});
  const [photoOpen, setPhotoOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const keptCount = useRef(0);
  const published = product?.status === "published";
  const retired = product?.status === "deactivated";
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const buy = cta === "buy";
  const file = cta === "file";
  const priced = buy || file;
  const quote = cta === "quote";
  const stepped = priced || quote;
  const fresh = !product;
  keptCount.current = kept.length;

  useEffect(() => {
    const errors = state.fieldErrors;
    if (!errors) return;
    const productKeys = Object.keys(errors).filter((key) => !ACCOUNT_FIELDS.has(key));
    if (productKeys.length === 0) return;
    setAccountOpen(false);
    setPreviewing(false);
    const details = ["title", "description", "videoUrl", "images", "category", "fileLinks"].some((key) => errors[key]);
    if (quote) {
      if (details) setStep(1);
      else if (["location", "fulfillment", "contactEmail", "contactPhone", "shippingNote", "sellerContact"].some((key) => errors[key])) setStep(2);
      else setStep(3);
      return;
    }
    if (!priced) return;
    if (details) setStep(1);
    else setStep(2);
  }, [priced, quote, state.fieldErrors]);

  useEffect(() => {
    if (state.displayName) setSeller(state.displayName);
    if (state.signedIn) {
      setNeedsAccount(false);
      setAccountOpen(false);
    }
  }, [state.displayName, state.signedIn]);

  useEffect(() => {
    if (!state.saved || !state.productId || state.savedAt == null || seenSave.current === state.savedAt) return;
    seenSave.current = state.savedAt;
    const images = state.images ?? [];
    savedRecord.current = { productId: state.productId, slug: state.slug, savedImages: images };
    setSavedId(state.productId);
    setSavedSlug(state.slug ?? "");
    setKept(images);
    restoredFiles.current = [];
    setPreviews([]);
    if (!product) {
      imageDraft.current = [];
      latest.current = {
        ...(latest.current ?? { fields: {}, checks: {}, images: [] }),
        productId: state.productId,
        slug: state.slug,
        savedImages: images,
        images: [],
      };
    }
    setNotice("saved");
  }, [product, state]);

  function remember() {
    const form = formRef.current;
    if (!form || product || skipSave.current) return;
    const next = captureDraft(form, imageDraft.current);
    next.productId = savedRecord.current.productId;
    next.slug = savedRecord.current.slug;
    next.savedImages = savedRecord.current.savedImages;
    latest.current = next;
  }

  useEffect(() => {
    if (!ready || product) return;
    const images = imageDraft.current;
    let cancel = false;
    if (!images.length) {
      restoredFiles.current = [];
      return;
    }
    void Promise.all(
      images.map(async (image) => {
        const blob = await (await fetch(image.dataUrl)).blob();
        return new File([blob], image.name || "photo", { type: image.type || blob.type });
      }),
    ).then((files) => {
      if (!cancel) restoredFiles.current = files;
    });
    return () => {
      cancel = true;
    };
  }, [ready, product, resetKey]);

  useEffect(() => {
    if (product || !ready) return;
    const form = formRef.current;
    if (!form) return;
    const onInput = () => remember();
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("click", onInput);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("click", onInput);
    };
    // remember reads refs; rebinding only when the form remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, ready, resetKey, cta]);

  useEffect(() => {
    if (product || !ready) return;
    const form = formRef.current;
    const onReset = () => {
      const saved = latest.current;
      if (!form || !saved || skipSave.current) return;
      window.setTimeout(() => restoreDraft(form, saved), 0);
    };
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [product, ready, resetKey]);

  const stepSeen = useRef(false);
  useEffect(() => {
    if (product || !ready) return;
    if (!stepSeen.current) {
      stepSeen.current = true;
      return;
    }
    remember();
    // Hidden buy fields update without an input event when the step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, ready, step]);

  useEffect(() => {
    const form = formRef.current;
    if (form) refreshRef.current(form);
  }, [kept, previews.length, state.fieldErrors, localErrors]);

  function fieldValue(form: HTMLFormElement, name: string) {
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) return field.value.trim();
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) return field.value.trim();
    return "";
  }

  function activeProblem(form: HTMLFormElement, name: string) {
    const value = fieldValue(form, name);
    if (name === "title") {
      if (value.length < 2) return "Enter a product name.";
      if (value.length > 80) return "Keep the name under 80 characters.";
      return null;
    }
    if (name === "category") {
      if (cta === "contact" || cta === "file") return null;
      const kind = fieldValue(form, "categoryKind");
      return categoryProblem(kind, fieldValue(form, "categoryGroup"), value, cta === "buy" || cta === "quote");
    }
    if (name === "description") {
      if (value.length > 2000) return `Keep the description under 2,000 characters (${value.length.toLocaleString("en-US")} so far).`;
      if (value.length < 10) {
        const remaining = 10 - value.length;
        return remaining === 10
          ? "Add a short description of at least 10 characters."
          : `Add ${remaining} more character${remaining === 1 ? "" : "s"} (at least 10).`;
      }
      return null;
    }
    if (name === "videoUrl") {
      if (!value) return null;
      try {
        const url = new URL(value);
        if (url.protocol === "http:" || url.protocol === "https:") return null;
      } catch {
        return "Enter a full http(s) video link.";
      }
      return "Enter a full http(s) video link.";
    }
    if (name === "fileLinks" || name === "fileLinksJson") {
      if (cta !== "file") return null;
      return parseFileLinks(fieldValue(form, "fileLinksJson")).error;
    }
    if (name === "price") {
      if (!value) return "Enter a price of at least $0.50.";
      if (!/^\d+(\.\d{1,2})?$/.test(value)) return "Enter a price like 128 or 128.50.";
      if (Math.round(Number(value) * 100) < 50) return "Enter a price of at least $0.50.";
      return null;
    }
    if (name === "location") return cta === "buy" || cta === "file" ? placeProblem(value) : value.length >= 2 ? null : "Add a public location, such as a city.";
    if (name === "paymentMethods") {
      if (cta !== "buy" && cta !== "file") return null;
      const country = splitLocation(fieldValue(form, "location")).country;
      if (!country) return "Choose a country before choosing how buyers pay.";
      const methods = parsePaymentMethods(value || "[]", country);
      if (methods.length === 0) return "Choose at least one way buyers can pay.";
      const ships = ["shippingEnabled", "deliveryEnabled"].some((item) => {
        const field = form.elements.namedItem(item);
        return field instanceof HTMLInputElement && field.checked;
      });
      if (ships && !methods.some((id) => isTransferMethod(id))) {
        return "Add a transfer method for delivery and shipping, such as Interac, Venmo, or Zelle.";
      }
      return null;
    }
    if (name === "cardPaymentUrl") {
      if (cta !== "buy" && cta !== "file") return null;
      const methods = parsePaymentMethods(fieldValue(form, "paymentMethods") || "[]", splitLocation(fieldValue(form, "location")).country);
      if (!methods.includes("card")) return null;
      return cardLinkProblem(value);
    }
    if (name === "interacEmail") {
      if (cta !== "buy" && cta !== "file") return null;
      const methods = parsePaymentMethods(fieldValue(form, "paymentMethods") || "[]", splitLocation(fieldValue(form, "location")).country);
      if (!methods.includes("interac")) return null;
      return interacEmailProblem(value);
    }
    if (name === "venmoUsername") {
      if (cta !== "buy" && cta !== "file") return null;
      const methods = parsePaymentMethods(fieldValue(form, "paymentMethods") || "[]", splitLocation(fieldValue(form, "location")).country);
      if (!methods.includes("venmo")) return null;
      return venmoUsernameProblem(value);
    }
    if (name === "zelleContact") {
      if (cta !== "buy" && cta !== "file") return null;
      const methods = parsePaymentMethods(fieldValue(form, "paymentMethods") || "[]", splitLocation(fieldValue(form, "location")).country);
      if (!methods.includes("zelle")) return null;
      return zelleContactProblem(fieldValue(form, "zelleMode") || "phone", value);
    }
    if (name === "sellerContact") {
      if (cta !== "buy" && cta !== "file") return null;
      return sellerContactProblem(fieldValue(form, "sellerContactMode") || "email", value);
    }
    if (name === "contactEmail") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : cta === "quote" ? "Enter a contact email." : "Enter an email for buyer replies.";
    }
    if (name === "quantityAvailable") {
      const mode = form.elements.namedItem("quantityMode");
      if (!(mode instanceof RadioNodeList) || mode.value !== "limited") return null;
      return /^\d{1,4}$/.test(value) ? null : "Enter how many you can sell, or choose Unlimited.";
    }
    if (name === "pickupNote") return value.length >= 2 ? null : "Add the pickup address.";
    if (name === "shippingNote") {
      if (cta !== "buy") return null;
      const ship = form.elements.namedItem("shippingEnabled");
      if (!(ship instanceof HTMLInputElement) || !ship.checked) return null;
      return value.trim().length >= 2 ? null : "Enter the delivery area.";
    }
    if (name === "shippingFee") return !value || /^\d+(\.\d{1,2})?$/.test(value) ? null : "Enter a shipping fee like 20 or leave it blank.";
    if (name === "deliveryFee") return !value || /^\d+(\.\d{1,2})?$/.test(value) ? null : "Enter a delivery fee like 18 or 0.";
    if (name === "deliveryRadiusKm") return /^\d{1,4}$/.test(value) ? null : "Enter a radius in kilometres.";
    if (name === "images") {
      const count = keptCount.current + restoredFiles.current.length;
      if (count > 6) return "Use up to 6 photos.";
      if (count < 1) return "Add at least one photo.";
      return null;
    }
    if (name === "fulfillment") {
      const names = cta === "buy"
        ? ["pickupEnabled", "shippingEnabled"]
        : ["pickupEnabled", "deliveryEnabled", "shippingEnabled", "onsiteEnabled", "remoteEnabled", "atLocationEnabled"];
      const chosen = names.some((item) => {
        const field = form.elements.namedItem(item);
        return field instanceof HTMLInputElement && field.checked;
      });
      if (chosen) return null;
      return cta === "buy" ? "Choose pickup, delivery, or shipping." : "Choose how you will provide it.";
    }
    return undefined;
  }

  function detailProblems() {
    const form = formRef.current;
    const errors: Record<string, string> = {};
    if (!form) return errors;
    for (const key of cta === "contact" ? ["title", "description"] : cta === "file" ? ["title", "description", "fileLinks"] : ["title", "description", "category"]) {
      const problem = activeProblem(form, key);
      if (problem) errors[key] = problem;
    }
    return errors;
  }

  function refreshHints(form: HTMLFormElement, fieldName = "") {
    setLive((current) => {
      const names = new Set([...Object.keys(state.fieldErrors ?? {}), ...Object.keys(localErrors), ...Object.keys(current)]);
      if (fieldName) names.add(fieldName);
      if (names.size === 0) return current;
      const next = { ...current };
      let changed = false;
      for (const name of names) {
        const problem = activeProblem(form, name);
        if (problem === undefined) continue;
        const value = problem ?? "";
        if (next[name] !== value) {
          next[name] = value;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  function hintFrom(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;
    const name = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.name : "";
    if (name === "shippingEnabled" || name === "deliveryEnabled") {
      refreshHints(event.currentTarget, "paymentMethods");
      refreshHints(event.currentTarget, "shippingNote");
    }
    if (name === "categoryKind" || name === "categoryGroup") {
      setLocalErrors((current) => {
        if (!current.category) return current;
        const next = { ...current };
        delete next.category;
        return next;
      });
      setLive((current) => (current.category ? { ...current, category: "" } : current));
    }
    if (name === "category") refreshHints(event.currentTarget, "category");
    refreshHints(event.currentTarget, name);
  }
  refreshRef.current = refreshHints;

  function showStep(next: 1 | 2 | 3) {
    if (step === 1 && next > 1) {
      const errors = detailProblems();
      if (Object.keys(errors).length > 0) {
        setLive((current) => {
          const copy = { ...current };
          let changed = false;
          for (const key of Object.keys(errors)) {
            if (key in copy) {
              delete copy[key];
              changed = true;
            }
          }
          return changed ? copy : current;
        });
        setLocalErrors(errors);
        setPreviewing(false);
        return;
      }
    }
    setLocalErrors({});
    setPreviewing(false);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  function openPreview(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const form = formRef.current;
    if (!form) return;
    const next = readPagePreview(new FormData(form), [...kept, ...previews], cta, seller);
    remember();
    // Wait until this click finishes. Replacing the button immediately can submit the form.
    window.setTimeout(() => {
      setPreview(next);
      setPreviewing(true);
      window.scrollTo({ top: 0 });
    }, 0);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement && submitter.name === "intent" ? submitter.value : "";
    if (intent !== "draft" && intent !== "publish") {
      event.preventDefault();
      return;
    }
    if (blockedOffer()) {
      event.preventDefault();
      return;
    }
    if (intent === "publish" && blockedPayments()) {
      event.preventDefault();
      return;
    }
    if (needsAccount && !accountOpen) {
      event.preventDefault();
      setAccountIntent(intent === "draft" ? "draft" : "publish");
      setAccountOpen(true);
      return;
    }
    remember();
  }

  function blockedOffer() {
    const form = formRef.current;
    if (!form || (cta !== "buy" && cta !== "file")) return false;
    const problems: Record<string, string> = {};
    for (const key of ["price", "location"]) {
      const problem = activeProblem(form, key);
      if (problem) problems[key] = problem;
    }
    if (Object.keys(problems).length === 0) return false;
    setLive((current) => ({ ...current, ...problems }));
    setPreviewing(false);
    setStep(2);
    window.scrollTo({ top: 0 });
    return true;
  }

  function blockedPayments() {
    const form = formRef.current;
    if (!form || (cta !== "buy" && cta !== "file")) return false;
    const problems: Record<string, string> = {};
    for (const key of ["paymentMethods", "cardPaymentUrl", "interacEmail", "venmoUsername", "zelleContact", "sellerContact", "shippingNote"]) {
      const problem = activeProblem(form, key);
      if (problem) problems[key] = problem;
    }
    if (Object.keys(problems).length === 0) return false;
    setLive((current) => ({ ...current, ...problems }));
    setPreviewing(false);
    setStep(2);
    const anchor = problems.shippingNote ? "[name=shippingNote]" : problems.sellerContact ? "[data-seller-contact]" : "[data-payment-methods]";
    document.querySelector(anchor)?.scrollIntoView({ block: "center" });
    return true;
  }

  function openAccount(intent: "draft" | "publish") {
    if (blockedOffer()) return;
    if (intent === "publish" && blockedPayments()) return;
    remember();
    setAccountIntent(intent);
    setAccountOpen(true);
  }

  const PHOTO_TYPES: Record<string, boolean> = { "image/jpeg": true, "image/png": true, "image/webp": true };

  async function applyFiles(files: File[]) {
    restoredFiles.current = files;
    setPreviews((current) => {
      for (const url of current) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
      return files.map((file) => URL.createObjectURL(file));
    });
    try {
      imageDraft.current = await Promise.all(files.map(readDraftImage));
    } catch {
      imageDraft.current = [];
    }
    remember();
  }

  function addImageFiles(incoming: File[]) {
    const images = incoming.filter((file) => PHOTO_TYPES[file.type]);
    if (images.length < incoming.length) setPhotoNote("Use JPG, PNG, or WebP photos.");
    else setPhotoNote("");
    const room = Math.max(0, 6 - keptCount.current - restoredFiles.current.length);
    if (room === 0) {
      setPhotoNote("Use up to 6 photos.");
      return;
    }
    const next = [...restoredFiles.current, ...images.slice(0, room)];
    if (images.length > room) setPhotoNote("Use up to 6 photos.");
    void applyFiles(next);
    setPhotoOpen(false);
  }

  function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    addImageFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function clearAll() {
    skipSave.current = true;
    latest.current = null;
    imageDraft.current = [];
    restoredFiles.current = [];
    savedRecord.current = {};
    setSavedId("");
    setSavedSlug("");
    setNotice(null);
    setPreviews([]);
    setDraft(null);
    setStep(1);
    setPreviewing(false);
    setPreview(null);
    setResetKey((key) => key + 1);
    setLocalErrors({});
    setLive({});
    setPhotoOpen(false);
    setPhotoNote("");
    window.setTimeout(() => {
      skipSave.current = false;
    }, 300);
  }

  function move(index: number, direction: -1 | 1) {
    setKept((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  }

  if (fresh && !ready) return null;

  const visibleErrors = { ...(state.fieldErrors ?? {}), ...localErrors };
  for (const [key, value] of Object.entries(live)) {
    if (value) visibleErrors[key] = value;
    else delete visibleErrors[key];
  }

  const draftButton =
    published || retired ? null : needsAccount ? (
      <button type="button" onClick={() => openAccount("draft")} className={`${ghostClass} flex-1`}>
        Save draft
      </button>
    ) : (
      <button name="intent" value="draft" disabled={pending} className={`${ghostClass} flex-1`}>
        Save draft
      </button>
    );
  const publishButton = needsAccount ? (
    <button type="button" onClick={() => openAccount("publish")} className={`${buttonClass} flex-1`}>
      Publish
    </button>
  ) : retired ? (
    <button type="button" onClick={() => setReactivateOpen(true)} disabled={pending} className={`${buttonClass} flex-1`}>
      Reactivate
    </button>
  ) : (
    <button name="intent" value="publish" disabled={pending} className={`${buttonClass} flex-1`}>
      {pending ? "Saving…" : published ? "Update Twig" : "Publish"}
    </button>
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={onSubmit}
      onInput={hintFrom}
      onChange={hintFrom}
      className="pb-36"
    >
      {photoOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setPhotoOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-photo-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="add-photo-title" className="font-serif text-3xl">Add a photo</h2>
            <div
              data-photo-drop
              tabIndex={0}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addImageFiles(Array.from(event.dataTransfer.files));
              }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files);
                if (files.length === 0) return;
                event.preventDefault();
                addImageFiles(files);
              }}
              className={`mt-4 grid h-28 place-items-center rounded-2xl border border-dashed px-4 text-center text-sm text-muted outline-none ${dragging ? "border-forest bg-moss" : "border-line bg-white"}`}
            >
              Drag photos here, or paste a copied image.
            </div>
            <button type="button" className={`${buttonClass} mt-4 w-full`} onClick={() => fileInput.current?.click()}>
              Choose files
            </button>
            <button type="button" className={`${ghostClass} mt-2 w-full`} onClick={() => cameraInput.current?.click()}>
              Camera
            </button>
            <button type="button" className={`${ghostClass} mt-2 w-full`} onClick={() => setPhotoOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {confirmClear ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setConfirmClear(false)} onKeyDown={(event) => { if (event.key === "Escape") setConfirmClear(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="clear-all-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 text-center shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="clear-all-title" className="font-serif text-3xl">Clear all</h2>
            <p className="mt-2 text-sm text-muted">Are you sure to clear all info?</p>
            <button
              type="button"
              className={`${buttonClass} mt-5 w-full`}
              onClick={() => {
                setConfirmClear(false);
                clearAll();
              }}
            >
              Clear all
            </button>
            <button type="button" className={`${ghostClass} mt-2 w-full`} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setNotice(null)} onKeyDown={(event) => { if (event.key === "Escape") setNotice(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="draft-saved-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 text-center shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="draft-saved-title" className="font-serif text-3xl">Draft saved</h2>
            <p className="mt-2 text-sm text-muted">Your Twig is saved to your account. You can keep editing.</p>
            <button type="button" autoFocus className={`${buttonClass} mt-5 w-full`} onClick={() => setNotice(null)}>
              OK
            </button>
          </div>
        </div>
      ) : null}
      {savedId ? <input type="hidden" name="id" value={savedId} /> : null}
      {savedSlug ? <input type="hidden" name="slug" value={savedSlug} /> : null}
      <input type="hidden" name="cta" value={cta} />
      {kept.map((image) => (
        <input key={image} type="hidden" name="kept" value={image} />
      ))}
      {state.error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {fresh && !previewing ? (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setConfirmClear(true)} className="text-sm text-danger">
            Clear all
          </button>
        </div>
      ) : null}
      <div key={resetKey} className={previewing ? "hidden" : undefined}>
      {priced ? (
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-paper-deep p-1">
          <button type="button" onClick={() => showStep(1)} className={`h-11 rounded-full text-sm font-medium ${step === 1 ? "bg-forest text-card" : "text-muted"}`}>
            1 · Details
          </button>
          <button type="button" onClick={() => showStep(2)} className={`h-11 rounded-full text-sm font-medium ${step === 2 ? "bg-forest text-card" : "text-muted"}`}>
            2 · Price
          </button>
        </div>
      ) : null}
      {quote ? (
        <div className="mt-6 grid grid-cols-3 gap-1 rounded-full bg-paper-deep p-1">
          <StepTab current={step} step={1} label="Description" onClick={() => showStep(1)} />
          <StepTab current={step} step={2} label="Detail" onClick={() => showStep(2)} />
          <StepTab current={step} step={3} label="Quote field" onClick={() => showStep(3)} />
        </div>
      ) : null}

      {needsUsername ? (
        <Field label="Username" required error={visibleErrors.username}>
          <input name="username" autoCapitalize="none" autoCorrect="off" placeholder="ava" className={inputClass} />
          <span className="mt-1 block text-xs text-muted">Your link will be twigigi.com/username/product</span>
        </Field>
      ) : null}
      <div className={stepped && step !== 1 ? "hidden" : undefined}>
      <Section title={cta === "quote" ? "Product/Service Title" : cta === "contact" ? "What can they ask about?" : ""} required={cta === "quote"}>
        <Field label={cta === "quote" ? "" : "Product Title"} required={cta !== "quote"} error={visibleErrors.title}>
          <input name="title" defaultValue={textValue(draft, "title", product?.title)} placeholder="Cedar planter box (at least 2 characters)" aria-label={cta === "quote" ? "Product/Service Title" : undefined} className={inputClass} />
        </Field>
        {cta === "contact" ? null : file ? (
          <div>
            <span className={labelClass}>Product category</span>
            <input value="Digital file" disabled aria-label="Product category" className={`${inputClass} disabled:cursor-not-allowed disabled:bg-paper-deep disabled:opacity-70`} />
            <input type="hidden" name="categoryKind" value="product" />
            <input type="hidden" name="categoryGroup" value="digital-file" />
            <input type="hidden" name="category" value="digital-file" />
            <Field label="Brand" optional>
              <input name="brand" defaultValue={textValue(draft, "brand", product?.brand)} placeholder="(optional)" className={inputClass} />
            </Field>
          </div>
        ) : (
          <>
            <CategoryFields
              kind={textValue(draft, "categoryKind", product?.categoryKind)}
              group={textValue(draft, "categoryGroup", product?.categoryGroup)}
              item={textValue(draft, "category", product?.category)}
              error={visibleErrors.category}
            />
            <Field label="Brand" optional>
              <input name="brand" defaultValue={textValue(draft, "brand", product?.brand)} placeholder="(optional)" className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Short description" required error={visibleErrors.description}>
          <textarea name="description" rows={9} defaultValue={textValue(draft, "description", product?.description)} placeholder={file ? "What the buyer is getting:\n- File types, such as STL, 3MF, or STEP\n- Layer height, material, supports\n(at least 10 characters)" : "Description for your product/service:\n-Size / Dimensions\n-Material\n-Color\n-Capacity\n-Weight\n-What's included\n(at least 10 characters)"} className={`${inputClass} h-auto py-3`} />
        </Field>
        <Field label="Video link" error={visibleErrors.videoUrl}>
          <input name="videoUrl" defaultValue={textValue(draft, "videoUrl", product?.videoUrl ?? "")} placeholder="https://youtu.be/… (http or https)" className={inputClass} />
        </Field>
      </Section>

      <Section title={file ? "Display photos" : "Photos"}>
        <p className="text-sm text-muted">{file ? "Preview photos only. The file link stays hidden until the order is paid. The first photo is the cover. Up to 6." : "The first photo is the cover and the social preview. Up to 6."}</p>
        {visibleErrors.images ? <p className="text-sm text-danger">{visibleErrors.images}</p> : null}
        {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
        <ul className="space-y-2">
          {kept.map((image, index) => (
            <li key={image} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <span className="text-sm text-muted">{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
              <span className="ml-auto flex gap-2 text-sm">
                <button type="button" onClick={() => move(index, -1)} className="text-forest">Up</button>
                <button type="button" onClick={() => move(index, 1)} className="text-forest">Down</button>
                <button type="button" onClick={() => setKept((current) => current.filter((item) => item !== image))} className="text-danger">Remove</button>
              </span>
            </li>
          ))}
        </ul>
        {previews.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {previews.map((preview) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={preview} src={preview} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ))}
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Add photos"
          onClick={() => setPhotoOpen(true)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addImageFiles(Array.from(event.dataTransfer.files));
          }}
          className={`grid h-16 w-full place-items-center rounded-2xl border border-dashed bg-white text-4xl leading-none text-ink ${dragging ? "border-forest bg-moss" : "border-line"}`}
        >
          +
        </button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} className="sr-only" />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onFiles} className="sr-only" />
        <p className="text-sm text-muted">
          {previews.length > 0
            ? `${previews.length} ${previews.length === 1 ? "photo" : "photos"} selected. JPG, PNG, or WebP.`
            : "JPG, PNG, or WebP. Drag, paste, or use the camera."}
        </p>
      </Section>
      {file ? (
        <FileLinkFields
          links={fileLinkSeed(draft, product)}
          password={textValue(draft, "filePassword", product?.filePassword)}
          error={visibleErrors.fileLinks}
        />
      ) : null}
      </div>

      {priced ? (
        <div className={step !== 2 ? "hidden" : undefined}>
          <BuyOfferFields product={product} errors={visibleErrors} seed={fresh ? draft : null} onChange={fresh ? remember : undefined} digital={file} />
          <Section title="Order email">
            <Field label="Email for new orders" error={visibleErrors.contactEmail}>
              <input name="contactEmail" type="email" defaultValue={emailValue(draft, product, defaultEmail)} placeholder="name@email.com (email)" className={inputClass} />
            </Field>
          </Section>
        </div>
      ) : null}

      {quote ? (
        <div className={step !== 2 ? "hidden" : undefined}>
          <Section title="Fulfillment area">
            <LocationField location={draft ? (draft.fields.location ?? "") : product?.location} error={visibleErrors.location} />
          </Section>
          <Section title="How will you provide it?">
            {visibleErrors.fulfillment ? <p className="text-sm text-danger">{visibleErrors.fulfillment}</p> : null}
            <ProvideChoice name="pickupEnabled" checked={boxChecked(draft, "pickupEnabled", product?.pickupEnabled)} title="Local pickup" detail="Customer picks it up" />
            <ProvideChoice name="deliveryEnabled" checked={boxChecked(draft, "deliveryEnabled", product?.deliveryEnabled)} title="Local delivery" detail="You deliver to the customer" />
            <ProvideChoice name="shippingEnabled" checked={boxChecked(draft, "shippingEnabled", product?.shippingEnabled)} title="Shipping" detail="Ship by mail or courier" />
            <ProvideChoice name="onsiteEnabled" checked={boxChecked(draft, "onsiteEnabled", product?.onsiteEnabled)} title="On-site service" detail="You go to the customer's location" />
            <ProvideChoice name="remoteEnabled" checked={boxChecked(draft, "remoteEnabled", product?.remoteEnabled)} title="Remote service" detail="Provided online or remotely" />
            <ProvideChoice name="atLocationEnabled" checked={boxChecked(draft, "atLocationEnabled", product?.atLocationEnabled)} title="At my location" detail="Customer comes to your business/location" />
          </Section>
          <Section title="How customers reach you">
            <Field label="Contact email" required error={visibleErrors.contactEmail}>
              <input name="contactEmail" type="email" defaultValue={emailValue(draft, product, defaultEmail)} placeholder="name@email.com (email)" className={inputClass} />
              <span className="mt-1 block text-xs text-muted">Twigigi will send the quote request to this email.</span>
            </Field>
            <Field label="Phone, optional" error={visibleErrors.contactPhone}>
              <input name="contactPhone" defaultValue={textValue(draft, "contactPhone", product?.contactPhone)} placeholder="(optional)" className={inputClass} />
            </Field>
          </Section>
        </div>
      ) : null}

      {quote ? (
        <div className={step !== 3 ? "hidden" : undefined}>
          <QuoteFormFields value={quoteDraft(draft, product)} onChange={remember} />
        </div>
      ) : null}

      {cta === "contact" ? (
        <>
          <Section title="Place">
            <LocationField location={draft ? (draft.fields.location ?? "") : product?.location} error={visibleErrors.location} />
          </Section>
          <Section title="How buyers reach you">
            <Field label="Reply email" error={visibleErrors.contactEmail}>
              <input name="contactEmail" type="email" defaultValue={emailValue(draft, product, defaultEmail)} placeholder="name@email.com (email)" className={inputClass} />
            </Field>
            <Field label="Phone, optional" error={visibleErrors.contactPhone}>
              <input name="contactPhone" defaultValue={textValue(draft, "contactPhone", product?.contactPhone)} placeholder="(optional)" className={inputClass} />
            </Field>
          </Section>
        </>
      ) : null}
      </div>

      {previewing && preview ? <PagePreview draft={preview} /> : null}

      {previewing ? (
        <div key="preview-actions" className="sticky bottom-3 mt-8 flex gap-2 rounded-full border border-line bg-card p-2 shadow-lg">
          <button type="button" onClick={() => setPreviewing(false)} className={ghostClass}>
            Back
          </button>
          {draftButton}
          {publishButton}
        </div>
      ) : stepped && step === 1 ? (
        <div className="sticky bottom-3 z-10 mt-8 rounded-full border border-line bg-card p-2 shadow-lg">
          <button type="button" onClick={() => showStep(2)} className={`${buttonClass} w-full`}>
            Next
          </button>
        </div>
      ) : quote && step === 2 ? (
        <div className="sticky bottom-3 mt-8 flex gap-2 rounded-full border border-line bg-card p-2 shadow-lg">
          <button type="button" onClick={() => showStep(1)} className={`${ghostClass} flex-1`}>
            Back
          </button>
          <button type="button" onClick={() => showStep(3)} className={`${buttonClass} flex-1`}>
            Next
          </button>
        </div>
      ) : (
      <div key="edit-actions" className="sticky bottom-3 mt-8 flex gap-2 rounded-full border border-line bg-card p-2 shadow-lg">
        {stepped ? (
          <button type="button" onClick={() => showStep(quote ? 2 : 1)} className={ghostClass}>
            Back
          </button>
        ) : null}
        {draftButton}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openPreview} className={`${buttonClass} flex-1`}>
          Preview
        </button>
      </div>
      )}
      <PublishAccount open={accountOpen} pending={pending} state={state} intent={accountIntent} onClose={() => setAccountOpen(false)} />
      {reactivateOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setReactivateOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reactivate-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="reactivate-title" className="font-serif text-3xl">Reactivate this Twig</h2>
            <p className="mt-2 text-sm text-muted">This publishes the Twig again and the link works. The 30-day permanent deletion is canceled.</p>
            <button name="intent" value="publish" disabled={pending} className={`${buttonClass} mt-5 w-full`}>
              {pending ? "Saving…" : "Reactivate"}
            </button>
            <button type="button" onClick={() => setReactivateOpen(false)} className={`${ghostClass} mt-2 w-full`}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

const ACCOUNT_FIELDS = new Set(["displayName", "username", "email", "password"]);

function restoreDraft(form: HTMLFormElement, draft: NewPageDraft) {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[name], textarea[name], select[name]").forEach((field) => {
    if (field instanceof HTMLInputElement && (field.type === "file" || field.type === "hidden" || field.type === "submit" || field.type === "button")) return;
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      if (Object.prototype.hasOwnProperty.call(draft.checks, field.name)) field.checked = draft.checks[field.name];
      return;
    }
    if (field instanceof HTMLInputElement && field.type === "radio") {
      if (draft.fields[field.name] != null) field.checked = field.value === draft.fields[field.name];
      return;
    }
    const value = draft.fields[field.name];
    if (value != null) field.value = value;
  });
}

function textValue(draft: NewPageDraft | null, key: string, fallback = "") {
  if (!draft) return fallback;
  return draft.fields[key] ?? "";
}

function fileLinkSeed(draft: NewPageDraft | null, product?: Product) {
  const raw = draft?.fields.fileLinksJson;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string") && parsed.length > 0) return parsed;
    } catch {
      return product?.fileLinks.length ? product.fileLinks : [""];
    }
  }
  return product?.fileLinks.length ? product.fileLinks : [""];
}

function emailValue(draft: NewPageDraft | null, product: Product | undefined, defaultEmail: string) {
  if (draft) return draft.fields.contactEmail ?? "";
  return product?.contactEmail || defaultEmail;
}

function boxChecked(draft: NewPageDraft | null, name: string, fallback?: boolean) {
  if (draft && Object.prototype.hasOwnProperty.call(draft.checks, name)) return draft.checks[name];
  return fallback;
}

function quoteDraft(draft: NewPageDraft | null, product?: Product): QuoteForm | null {
  if (!draft) return product?.quoteForm ?? null;
  const raw = draft.fields.quoteFormJson;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuoteForm;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function StepTab({ current, step, label, onClick }: { current: number; step: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-11 rounded-full px-2 text-sm font-medium ${current === step ? "bg-forest text-card" : "text-muted"}`}>
      {step} · {label}
    </button>
  );
}

function Section({ title, required, children }: { title?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      {title ? (
        <h2 className="font-serif text-2xl">
          {title}
          {required ? (
            <>
              <span className="text-danger"> *</span>
              <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">Required</span>
            </>
          ) : null}
        </h2>
      ) : null}
      <div className={title ? "mt-4 space-y-4" : "space-y-4"}>{children}</div>
    </section>
  );
}

function Field({ label, error, required, optional, children }: { label: string; error?: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
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
          {optional ? <span className="ml-1 font-normal text-muted"> Optional</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  );
}

function LocationField({ location, error }: { location?: string; error?: string }) {
  const initial = splitLocation(location ?? "");
  const [city, setCity] = useState(initial.city);
  const [province, setProvince] = useState(initial.province);
  const [country, setCountry] = useState(initial.country);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const hiddenRef = useRef<HTMLInputElement>(null);
  const provinces = PROVINCES[country] ?? {};
  const joined = joinLocation(city, province, country);
  const seen = useRef(false);

  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [joined]);

  async function locate() {
    setLocating(true);
    setLocateError("");
    try {
      const place = await lookupCurrentPlace();
      setCity(place.city);
      setCountry(place.country);
      setProvince(place.province);
    } catch (reason) {
      setLocateError(reason instanceof Error ? reason.message : "Could not find this location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Location</span>
        <button type="button" onClick={locate} disabled={locating} className="text-sm text-forest disabled:opacity-60">
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_4.75rem] gap-2">
        <label className="block min-w-0">
          <span className={labelClass}>City</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Edmonton (city)" aria-label="City" className={inputClass} />
        </label>
        <label className="block">
          <span className={`${labelClass} whitespace-nowrap`}>Province</span>
          <select
            value={provinces[province] ? province : ""}
            disabled={!country}
            onChange={(event) => setProvince(event.target.value)}
            aria-label="Province"
            className={`${inputClass} px-2`}
          >
            <option value="">—</option>
            {Object.keys(provinces).map((code) => (
              <option key={code} value={code} title={provinces[code]}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={`${labelClass} whitespace-nowrap`}>Country</span>
          <select
            value={country}
            onChange={(event) => {
              const next = event.target.value;
              setCountry(next);
              if (!PROVINCES[next]?.[province]) setProvince("");
            }}
            aria-label="Country"
            className={`${inputClass} px-2`}
          >
            <option value="">—</option>
            <option value="US">US</option>
            <option value="CA">CA</option>
          </select>
        </label>
      </div>
      <input ref={hiddenRef} type="hidden" name="location" value={joined} />
      <span className="mt-2 block text-xs text-muted">City, province, and country. Do not put a private street address here.</span>
      {locateError ? <span className="mt-1 block text-sm text-danger">{locateError}</span> : null}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </div>
  );
}

function ProvideChoice({ name, checked, title, detail }: { name: string; checked?: boolean; title: string; detail: string }) {
  return (
    <label className="flex items-start gap-3 text-base">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 h-5 w-5 accent-forest" />
      <span>
        <span className="font-medium">{title}</span>
        <span className="text-muted"> — {detail}</span>
      </span>
    </label>
  );
}
