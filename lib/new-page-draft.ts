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
