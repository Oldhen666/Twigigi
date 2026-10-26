import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <p className="text-sm text-clay">404</p>
      <h1 className="mt-2 font-serif text-4xl">This Twig is not published</h1>
      <p className="mt-3 text-muted">The link may be a draft, deactivated, or the name changed.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
        Back to Twigigi
      </Link>
    </main>
  );
}
