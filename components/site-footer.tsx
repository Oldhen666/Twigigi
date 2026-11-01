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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md leading-6">Twigigi provides the platform. Listing information is provided by the person who posted it.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-ink">{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
