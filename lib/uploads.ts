import fs from "node:fs";
import path from "node:path";

const FILE_NAME = /^[a-zA-Z0-9._-]+$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function uploadDirectory() {
  return path.join(process.cwd(), "data", "uploads");
}

export function storedUpload(src: string) {
  return src.startsWith("/uploads/");
}

function uploadName(urlPath: string) {
  const name = urlPath.replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!FILE_NAME.test(name)) return null;
  return name;
}

export function resolveUpload(urlPath: string) {
  const name = uploadName(urlPath);
  if (!name) return null;
  const roots = [uploadDirectory(), path.join(process.cwd(), "public", "uploads")];
  for (const root of roots) {
    const full = path.join(root, name);
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (!full.startsWith(rootWithSep) || !fs.existsSync(full)) continue;
    return full;
  }
  return null;
}

export function uploadContentType(filePath: string) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
