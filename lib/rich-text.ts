const BLOCK = new Set(["b", "i", "u", "s", "br", "p", "div", "ul", "ol", "li", "span", "strong", "em", "strike", "font"]);
const RENAME: Record<string, string> = { strong: "b", em: "i", strike: "s", font: "span" };
const SIZES: Record<string, string> = { "1": "14px", "2": "14px", "3": "16px", "4": "18px", "5": "20px", "6": "24px", "7": "28px" };

function escapeText(value: string) {
  return value
    .replace(/&(?![a-z]+;|#\d+;|#x[\da-f]+;)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attr(source: string, name: string) {
  const found = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(source);
  return (found?.[1] ?? found?.[2] ?? found?.[3] ?? "").trim();
}

function safeColor(value: string) {
  const color = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(color) || /^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(color);
  if (!rgb) return "";
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel > 255)) return "";
  return `rgb(${channels.join(", ")})`;
}

function safeSize(value: string) {
  const size = value.trim().toLowerCase();
  if (SIZES[size]) return SIZES[size];
  return /^(14|16|18|20|24|28)px$/.test(size) ? size : "";
}

function safeFace(value: string) {
  const face = value.toLowerCase();
  if (face.includes("georgia") || face.includes("fraunces") || /\bserif\b/.test(face)) return "Georgia, serif";
  if (face.includes("avenir") || face.includes("segoe") || face.includes("outfit") || face.includes("sans")) return '"Avenir Next", "Segoe UI", sans-serif';
  return "";
}

function styleFrom(raw: string) {
  const parts: string[] = [];
  const color = safeColor(attr(raw, "color"));
  const size = safeSize(attr(raw, "size"));
  const face = safeFace(attr(raw, "face"));
  const style = attr(raw, "style");
  if (color) parts.push(`color: ${color}`);
  if (size) parts.push(`font-size: ${size}`);
  if (face) parts.push(`font-family: ${face}`);
  for (const chunk of style.split(";")) {
    const split = chunk.indexOf(":");
    if (split < 0) continue;
    const key = chunk.slice(0, split).trim().toLowerCase();
    const val = chunk.slice(split + 1).trim();
    if (/url\(|expression\(|javascript:/i.test(val)) continue;
    if (key === "color" && !color) {
      const next = safeColor(val);
      if (next) parts.push(`color: ${next}`);
    } else if (key === "font-size" && !size) {
      const next = safeSize(val);
      if (next) parts.push(`font-size: ${next}`);
    } else if (key === "font-family" && !face) {
      const next = safeFace(val);
      if (next) parts.push(`font-family: ${next}`);
    }
  }
  return parts.join("; ");
}

export function sanitizeDescription(input: string) {
  const source = input.replace(/\0/g, "").replace(/<!--[\s\S]*?-->/g, "");
  if (!/<[a-z!/]/i.test(source)) return source.trim();
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let out = "";
  let last = 0;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out += escapeText(source.slice(last, match.index));
    last = re.lastIndex;
    const raw = match[1].toLowerCase();
    if (!BLOCK.has(raw)) continue;
    const tag = RENAME[raw] ?? raw;
    const closing = match[0].startsWith("</");
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "span") {
      const style = styleFrom(match[0]);
      out += style ? `<span style="${style}">` : "<span>";
      stack.push("span");
      continue;
    }
    out += `<${tag}>`;
    stack.push(tag);
  }
  out += escapeText(source.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  let clean = out;
  let previous = "";
  while (clean !== previous) {
    previous = clean;
    clean = clean.replace(/<span>([\s\S]*?)<\/span>/g, "$1");
  }
  return clean.trim();
}

export function hasFormatting(value: string) {
  return /<(b|i|u|s|ul|ol|span)\b/i.test(sanitizeDescription(value));
}

export function descriptionPlain(value: string) {
  const clean = sanitizeDescription(value);
  if (!/<[a-z]/i.test(clean)) return clean.trim();
  return decode(
    clean
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function storedDescription(value: string) {
  const clean = sanitizeDescription(value);
  return hasFormatting(clean) ? clean : descriptionPlain(clean);
}
