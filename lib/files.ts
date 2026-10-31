const MAX_LINKS = 8;

export function parseFileLinks(raw: string) {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return { links: [] as string[], error: "Add a file link." };
  }
  if (!Array.isArray(parsed)) return { links: [] as string[], error: "Add a file link." };
  const links = parsed
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_LINKS);
  if (links.length === 0) return { links, error: "Add at least one file link." };
  if (parsed.filter((item) => typeof item === "string" && item.trim()).length > MAX_LINKS) {
    return { links, error: "Use up to 8 file links." };
  }
  return { links, error: linkProblem(links) };
}

function linkProblem(links: string[]) {
  for (const link of links) {
    if (link.length > 500) return "Keep each link under 500 characters.";
    try {
      const url = new URL(link);
      if (url.protocol !== "https:") return "Use an https link.";
    } catch {
      return "Enter a full https link.";
    }
  }
  return null;
}

export function readStoredFileLinks(raw: string) {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.startsWith("https://")).slice(0, MAX_LINKS);
  } catch {
    return [];
  }
}
