"use client";

import { useState } from "react";
import Link from "next/link";
import { inputClass, labelClass } from "@/components/ui";

export function FileLinkFields({
  links,
  password,
  error,
  rightsError,
}: {
  links: string[];
  password: string;
  error?: string;
  rightsError?: string;
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
        Paste one or more https links, such as Google Drive, Dropbox, or OneDrive. Set each share to anyone with the link. When the payment is confirmed, Twigigi emails these links and the password. You can send them again from the order.
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
          Optional. Google Drive cannot password a share link, so put the password on the zip and type it here. It is emailed with the links when you send the file.
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6">
        <p>Only upload or link to digital products that you own or are authorized to sell and distribute.</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-forest">Copyright &amp; Seller Responsibility</summary>
          <div className="mt-2 space-y-2 text-muted">
            <p>You are responsible for ensuring that your files, product images, descriptions, and linked content do not infringe any third party’s copyright, trademark, or other intellectual property rights. Purchasing or downloading a file does not, by itself, give you permission to resell or redistribute it. AI-generated or modified content must also comply with these requirements.</p>
            <p>You must clearly describe the buyer’s permitted use, including any restrictions on commercial use, modification, redistribution, or resale.</p>
            <p>Twigigi provides tools for sellers to list and share digital products. A listing’s availability on Twigigi does not constitute verification of ownership, authorization, or legal compliance.</p>
            <p>Twigigi may request proof of ownership or authorization, remove or disable access to listings or files, and suspend or terminate accounts in response to suspected infringement or violations of its policies.</p>
          </div>
        </details>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" name="digitalRights" value="yes" className="mt-1 h-4 w-4 accent-forest" />
        <span>
          I confirm that I own this content or have all permissions necessary to list, sell, and distribute it, including its preview images and any linked files. I accept responsibility for its compliance with intellectual property laws and agree to Twigigi’s <Link href="/legal/copyright" className="text-forest">Copyright Policy</Link> and <Link href="/legal/terms" className="text-forest">Terms of Service</Link>.
        </span>
      </label>
      {rightsError ? <p className="mt-2 text-sm text-danger">{rightsError}</p> : null}
    </section>
  );
}
