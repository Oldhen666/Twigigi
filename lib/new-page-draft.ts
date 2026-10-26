export type DraftImage = {
  name: string;
  type: string;
  dataUrl: string;
};

export type NewPageDraft = {
  fields: Record<string, string>;
  checks: Record<string, boolean>;
  images: DraftImage[];
  productId?: string;
  slug?: string;
  savedImages?: string[];
};

const SKIP = new Set(["id", "slug", "cta", "kept", "intent", "accountMode", "displayName", "username", "email", "password"]);

function key(cta: string) {
  return `twigigi-new-${cta}`;
}

export function loadNewPageDraft(cta: string): NewPageDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(cta));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewPageDraft;
    if (!parsed || typeof parsed.fields !== "object" || !parsed.fields) return null;
    return {
      fields: parsed.fields,
      checks: parsed.checks ?? {},
      images: Array.isArray(parsed.images) ? parsed.images : [],
      productId: typeof parsed.productId === "string" ? parsed.productId : undefined,
      slug: typeof parsed.slug === "string" ? parsed.slug : undefined,
      savedImages: Array.isArray(parsed.savedImages) ? parsed.savedImages.filter((item) => typeof item === "string") : undefined,
    };
  } catch {
    return null;
  }
}

export function saveNewPageDraft(cta: string, draft: NewPageDraft) {
  try {
    sessionStorage.setItem(key(cta), JSON.stringify(draft));
  } catch {
    try {
      sessionStorage.setItem(key(cta), JSON.stringify({ ...draft, images: [] }));
    } catch {
      // The browser refused the saved draft.
    }
  }
}

export function clearNewPageDraft(cta: string) {
  sessionStorage.removeItem(key(cta));
}

export function captureDraft(form: HTMLFormElement, images: DraftImage[]): NewPageDraft {
  const fields: Record<string, string> = {};
  for (const [name, value] of new FormData(form).entries()) {
    if (value instanceof File || SKIP.has(name)) continue;
    fields[name] = value;
  }
  const checks: Record<string, boolean> = {};
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]').forEach((box) => {
    checks[box.name] = box.checked;
  });
  return { fields, checks, images };
}

export function readDraftImage(file: File): Promise<DraftImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result) });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
