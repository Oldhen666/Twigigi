import type { QuoteForm } from "@/lib/types";

const MAX_LINES = 8;

export function blankQuoteForm(): QuoteForm {
  return {
    askName: true,
    askPhone: true,
    askCompany: false,
    askAddress: false,
    askQuantity: true,
    items: [],
    questions: [],
    terms: "",
  };
}

export function parseQuoteForm(raw: string): QuoteForm | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return normalizeQuoteForm(JSON.parse(text));
  } catch {
    return null;
  }
}

export function normalizeQuoteForm(value: unknown): QuoteForm {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(row.items) ? row.items : [];
  const questions = Array.isArray(row.questions) ? row.questions : [];
  return {
    askName: row.askName !== false,
    askPhone: row.askPhone !== false,
    askCompany: row.askCompany === true,
    askAddress: row.askAddress === true,
    askQuantity: row.askQuantity !== false,
    items: items
      .slice(0, MAX_LINES)
      .map((item, index) => cleanItem(item, index))
      .filter((item) => item.description),
    questions: questions
      .slice(0, MAX_LINES)
      .map((item, index) => cleanQuestion(item, index))
      .filter((item) => item.label),
    terms: typeof row.terms === "string" ? row.terms.trim().slice(0, 1000) : "",
  };
}

function cleanItem(item: unknown, index: number) {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" && record.id ? record.id.slice(0, 40) : `line-${index + 1}`,
    description: typeof record.description === "string" ? record.description.trim().slice(0, 120) : "",
  };
}

function cleanQuestion(item: unknown, index: number) {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" && record.id ? record.id.slice(0, 40) : `q-${index + 1}`,
    label: typeof record.label === "string" ? record.label.trim().slice(0, 120) : "",
    required: record.required === true,
  };
}
