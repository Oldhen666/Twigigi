import Link from "next/link";

const LINKS = [
  ["/legal/terms", "Terms of Service"],
  ["/legal/privacy", "Privacy Policy"],
  ["/legal/intellectual-property", "Intellectual Property"],
  ["/legal/prohibited-items", "Prohibited Items"],
  ["/legal/report-infringement", "Report Infringement"],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl px-5 py-8 text-sm text-muted">
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-ink">{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
