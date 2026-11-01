import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  version,
  children,
}: {
  eyebrow: string;
  title: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 pb-20">
      <p className="text-sm text-muted">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-4xl">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Version {version}. This page explains how Twigigi operates. It is not legal advice.</p>
      <div className="mt-8 space-y-8 text-sm leading-6">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalLinks() {
  const links = [
    ["/legal/terms", "Terms of Service"],
    ["/legal/privacy", "Privacy Policy"],
    ["/legal/intellectual-property", "Intellectual Property"],
    ["/legal/prohibited-items", "Prohibited Items"],
    ["/legal/report-infringement", "Report Infringement"],
  ];
  return (
    <p className="text-sm text-muted">
      {links.map(([href, label], index) => (
        <span key={href}>
          {index > 0 ? " · " : null}
          <Link href={href} className="text-forest">{label}</Link>
        </span>
      ))}
    </p>
  );
}
