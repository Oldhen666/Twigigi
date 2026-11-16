import { descriptionPlain, hasFormatting, sanitizeDescription } from "@/lib/rich-text";

export function RichDescription({ text, className = "text-[15px] leading-7" }: { text: string; className?: string }) {
  const clean = sanitizeDescription(text);
  if (!hasFormatting(clean)) {
    return <p className={`whitespace-pre-wrap ${className}`}>{descriptionPlain(clean)}</p>;
  }
  return <div className={`rich-copy ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
