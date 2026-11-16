"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hasFormatting, sanitizeDescription, storedDescription } from "@/lib/rich-text";

const COLORS = [
  { label: "Ink", value: "#1c1915" },
  { label: "Forest", value: "#1b4332" },
  { label: "Leaf", value: "#2d6a4f" },
  { label: "Clay", value: "#c4552a" },
  { label: "Muted", value: "#6d655b" },
];

const SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Larger", value: "6" },
];

export function DescriptionEditor({ value, placeholder }: { value: string; placeholder: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || seeded.current) return;
    seeded.current = true;
    const clean = sanitizeDescription(value);
    if (hasFormatting(clean)) editor.innerHTML = clean;
    else editor.innerText = value;
    markEmpty(editor);
  }, [value]);

  function markEmpty(editor: HTMLElement) {
    editor.dataset.empty = editor.textContent?.trim() ? "false" : "true";
  }

  function rememberRange() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;
    rangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreRange() {
    const selection = window.getSelection();
    const range = rangeRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function sync() {
    const editor = editorRef.current;
    const field = fieldRef.current;
    if (!editor || !field) return;
    markEmpty(editor);
    field.value = storedDescription(editor.innerHTML);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function run(command: string, argument?: string) {
    editorRef.current?.focus();
    restoreRange();
    document.execCommand(command, false, argument);
    sync();
    rememberRange();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-paper px-2 py-2">
        <ToolButton label="Bold" onClick={() => run("bold")}><b>B</b></ToolButton>
        <ToolButton label="Italic" onClick={() => run("italic")}><i>I</i></ToolButton>
        <ToolButton label="Underline" onClick={() => run("underline")}><u>U</u></ToolButton>
        <ToolButton label="Strikethrough" onClick={() => run("strikeThrough")}><s>S</s></ToolButton>
        <select
          aria-label="Font"
          defaultValue=""
          onMouseDown={rememberRange}
          onChange={(event) => {
            const face = event.target.value;
            event.target.value = "";
            if (face) run("fontName", face);
          }}
          className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-ink"
        >
          <option value="">Font</option>
          <option value="Georgia">Serif</option>
          <option value="Avenir Next">Sans</option>
        </select>
        <select
          aria-label="Size"
          defaultValue=""
          onMouseDown={rememberRange}
          onChange={(event) => {
            const size = event.target.value;
            event.target.value = "";
            if (size) run("fontSize", size);
          }}
          className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-ink"
        >
          <option value="">Size</option>
          {SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </select>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        {COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            aria-label={color.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run("foreColor", color.value)}
            className="h-6 w-6 rounded-full border border-line"
            style={{ background: color.value }}
          />
        ))}
        <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line bg-white text-xs text-muted" aria-label="Custom color">
          <span aria-hidden="true">A</span>
          <input
            type="color"
            defaultValue="#1c1915"
            onMouseDown={rememberRange}
            onChange={(event) => run("foreColor", event.target.value)}
            className="sr-only"
          />
        </label>
        <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>•</ToolButton>
        <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>1.</ToolButton>
        <ToolButton label="Clear formatting" onClick={() => run("removeFormat")}>Clear</ToolButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Short description"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={sync}
        onKeyUp={rememberRange}
        onMouseUp={rememberRange}
        className="rich-editor min-h-52 px-3 py-3 text-base leading-7 text-ink outline-none"
      />
      <textarea ref={fieldRef} name="description" defaultValue={value} className="sr-only" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-line bg-white px-2 text-sm text-ink"
    >
      {children}
    </button>
  );
}
