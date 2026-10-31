"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/ui";

export function FileLinkFields({
  links,
  password,
  error,
}: {
  links: string[];
  password: string;
  error?: string;
}) {
  const [rows, setRows] = useState(links.length > 0 ? links : [""]);
  const [secret, setSecret] = useState(password);
  const stored = rows.map((row) => row.trim()).filter(Boolean);

  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">
        File links
        <span className="text-base text-danger"> *</span>
      </h2>
      <p className="mt-2 text-sm text-muted">
        Paste one or more https links, such as Google Drive, Dropbox, or OneDrive. Set each share to anyone with the link. Buyers only receive the links and password after the order is paid.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={row}
              onChange={(event) => setRows(rows.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
              placeholder="https://drive.google.com/…"
              aria-label={`File link ${index + 1}`}
              className={inputClass}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, itemIndex) => itemIndex !== index))}
                className="text-sm text-danger"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {rows.length < 8 ? (
          <button type="button" onClick={() => setRows([...rows, ""])} className="text-sm text-forest">
            Add another link
          </button>
        ) : null}
      </div>
      <input type="hidden" name="fileLinksJson" value={JSON.stringify(stored)} />
      <div className="mt-6">
        <label className={labelClass} htmlFor="filePassword">
          File password
        </label>
        <input
          id="filePassword"
          name="filePassword"
          value={secret}
          autoComplete="off"
          onChange={(event) => setSecret(event.target.value.slice(0, 80))}
          placeholder="Optional zip password"
          className={inputClass}
        />
        <p className="mt-1 text-sm text-muted">
          Optional. Google Drive cannot password a share link, so put the password on the zip and type it here. It is emailed with the links only after payment.
        </p>
      </div>
    </section>
  );
}
