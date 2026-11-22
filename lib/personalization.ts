export const PERSONALIZATION_FILE_ACCEPT = "image/jpeg,image/png,image/webp";
export const PERSONALIZATION_FILE_HELP = "JPG, PNG, or WebP, under 5 MB each.";
export const PERSONALIZATION_FILE_LIMIT = 3;
export const PERSONALIZATION_TEXT_LIMIT = 80;

export type PersonalizationField =
  | { id: string; kind: "text"; label: string; help: string; required: boolean; maxLength: number }
  | { id: string; kind: "file"; label: string; help: string; required: boolean; maxFiles: number }
  | { id: string; kind: "choice"; label: string; help: string; required: boolean; options: string[] }
  | { id: string; kind: "note"; label: string; help: string; required: boolean };

export type PersonalizationConfig = {
  enabled: boolean;
  proof: boolean;
  fields: PersonalizationField[];
};

export type PersonalizationFile = { path: string; name: string };

export type PersonalizationAnswer = {
  id: string;
  kind: PersonalizationField["kind"];
  label: string;
  value: string;
  files: PersonalizationFile[];
};

export type ProofVersion = {
  id: string;
  note: string;
  files: PersonalizationFile[];
  createdAt: string;
  current: boolean;
};

export type PersonalizationSnapshot = {
  proofRequested: boolean;
  answers: PersonalizationAnswer[];
  proofs: ProofVersion[];
  decision: "" | "approved" | "changes";
  decisionNote: string;
  decisionProofId: string;
};

export function emptyPersonalization(): PersonalizationConfig {
  return { enabled: false, proof: false, fields: [] };
}

export function legacyUploadPersonalization(): PersonalizationConfig {
  return {
    enabled: true,
    proof: false,
    fields: [{
      id: "upload",
      kind: "file",
      label: "Your image",
      help: "Add the picture for this custom order.",
      required: true,
      maxFiles: PERSONALIZATION_FILE_LIMIT,
    }],
  };
}

export function collectsPersonalization(config: PersonalizationConfig) {
  return config.enabled && (config.fields.length > 0 || config.proof);
}

export function readPersonalization(raw: string, buyerUpload: boolean): PersonalizationConfig {
  const stored = normalizePersonalization(parseJson(raw));
  if (stored) return stored;
  return buyerUpload ? legacyUploadPersonalization() : emptyPersonalization();
}

export function personalizationFromSeller(raw: string): { ok: true; config: PersonalizationConfig } | { ok: false; error: string } {
  const config = normalizePersonalization(parseJson(raw));
  if (!config) return { ok: false, error: "Check the personalization fields and try again." };
  if (config.fields.length > 6) return { ok: false, error: "Use up to 6 personalization fields." };
  return { ok: true, config };
}

export function answerFromBuyer(
  config: PersonalizationConfig,
  values: Record<string, string>,
  files: Record<string, PersonalizationFile[]>,
): { ok: true; answers: PersonalizationAnswer[] } | { ok: false; errors: Record<string, string> } {
  if (!config.enabled) return { ok: true, answers: [] };
  const errors: Record<string, string> = {};
  const answers: PersonalizationAnswer[] = [];
  for (const field of config.fields) {
    if (field.kind === "file") {
      const saved = (files[field.id] ?? []).slice(0, field.maxFiles);
      if (field.required && saved.length < 1) errors[field.id] = `Add ${field.label}.`;
      if (saved.length > field.maxFiles) errors[field.id] = `Add up to ${field.maxFiles} ${field.maxFiles === 1 ? "file" : "files"}.`;
      answers.push({ id: field.id, kind: field.kind, label: field.label, value: "", files: saved });
      continue;
    }
    const value = (values[field.id] ?? "").trim();
    if (field.kind === "text") {
      if (field.required && !value) errors[field.id] = `Enter ${field.label}.`;
      if (value.length > field.maxLength) errors[field.id] = `Keep ${field.label} under ${field.maxLength} characters.`;
    }
    if (field.kind === "choice") {
      if (field.required && !value) errors[field.id] = `Choose ${field.label}.`;
      if (value && !field.options.includes(value)) errors[field.id] = `Choose one of the ${field.label} options.`;
    }
    if (field.kind === "note" && value.length > 400) errors[field.id] = "Keep this note under 400 characters.";
    answers.push({ id: field.id, kind: field.kind, label: field.label, value, files: [] });
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, answers };
}

export function personalizationSummary(variantLabel: string, answers: PersonalizationAnswer[]) {
  const line = [variantLabel.replaceAll(" / ", " · "), ...answers.filter((answer) => answer.kind !== "file" && answer.kind !== "note" && answer.value).map((answer) => answer.value)]
    .filter(Boolean)
    .join(" · ");
  const files = answers.filter((answer) => answer.kind === "file").flatMap((answer) => answer.files.map((file) => ({ label: answer.label, name: file.name })));
  const notes = answers.filter((answer) => answer.kind === "note" && answer.value).map((answer) => ({ label: answer.label, value: answer.value }));
  return { line, files, notes };
}

export function emptySnapshot(config: PersonalizationConfig, answers: PersonalizationAnswer[]): PersonalizationSnapshot {
  return { proofRequested: config.proof, answers, proofs: [], decision: "", decisionNote: "", decisionProofId: "" };
}

export function addProof(snapshot: PersonalizationSnapshot, proof: ProofVersion): PersonalizationSnapshot {
  return {
    ...snapshot,
    proofs: [...snapshot.proofs.map((item) => ({ ...item, current: false })), { ...proof, current: true }],
    decision: "",
    decisionNote: "",
    decisionProofId: "",
  };
}

export function decideProof(snapshot: PersonalizationSnapshot, decision: "approved" | "changes", note: string): { ok: true; snapshot: PersonalizationSnapshot } | { ok: false; error: string } {
  const current = snapshot.proofs.find((proof) => proof.current);
  if (!current) return { ok: false, error: "There is no proof to review." };
  return {
    ok: true,
    snapshot: { ...snapshot, decision, decisionNote: note.slice(0, 400), decisionProofId: current.id },
  };
}

function parseJson(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizePersonalization(value: unknown): PersonalizationConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { enabled?: unknown; proof?: unknown; fields?: unknown };
  if (!Array.isArray(record.fields)) return null;
  const fields: PersonalizationField[] = [];
  for (const item of record.fields.slice(0, 6)) {
    const field = normalizeField(item);
    if (!field) return null;
    fields.push(field);
  }
  return { enabled: record.enabled === true, proof: record.proof === true, fields };
}

function normalizeField(value: unknown): PersonalizationField | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = cleanId(record.id);
  const label = cleanText(record.label, 40);
  const help = cleanText(record.help, 120);
  const required = record.required === true;
  if (!id || !label) return null;
  if (record.kind === "text") {
    const maxLength = Number(record.maxLength);
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > PERSONALIZATION_TEXT_LIMIT) return null;
    return { id, kind: "text", label, help, required, maxLength };
  }
  if (record.kind === "file") {
    const maxFiles = Number(record.maxFiles);
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > PERSONALIZATION_FILE_LIMIT) return null;
    return { id, kind: "file", label, help, required, maxFiles };
  }
  if (record.kind === "choice") {
    const options = Array.isArray(record.options) ? record.options.map((option) => cleanText(option, 40)).filter(Boolean).slice(0, 8) : [];
    if (options.length < 2) return null;
    return { id, kind: "choice", label, help, required, options };
  }
  if (record.kind === "note") return { id, kind: "note", label, help, required };
  return null;
}

function cleanId(value: unknown) {
  const id = typeof value === "string" ? value : "";
  return /^[a-zA-Z0-9_-]{1,24}$/.test(id) ? id : "";
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readSnapshot(raw: string): PersonalizationSnapshot | null {
  const value = parseJson(raw);
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PersonalizationSnapshot>;
  if (!Array.isArray(record.answers)) return null;
  return {
    proofRequested: record.proofRequested === true,
    answers: record.answers.filter((answer): answer is PersonalizationAnswer => Boolean(answer && typeof answer === "object" && typeof answer.id === "string" && typeof answer.label === "string")),
    proofs: Array.isArray(record.proofs) ? record.proofs.filter((proof): proof is ProofVersion => Boolean(proof && typeof proof === "object" && typeof proof.id === "string")) : [],
    decision: record.decision === "approved" || record.decision === "changes" ? record.decision : "",
    decisionNote: typeof record.decisionNote === "string" ? record.decisionNote : "",
    decisionProofId: typeof record.decisionProofId === "string" ? record.decisionProofId : "",
  };
}
