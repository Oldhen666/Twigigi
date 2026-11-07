import Link from "next/link";
import { Suspense } from "react";
import { requireSeller } from "@/lib/auth";

async function SettingsScreen() {
  const user = await requireSeller();
  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Settings</h1>
      <p className="mt-2 text-sm text-muted">Your public page and Twigigi billing.</p>
      <div className="mt-6 space-y-3 text-sm">
        <Link href={`/${user.publicId}`} className="block rounded-3xl border border-line bg-card px-4 py-4 font-medium">Your page</Link>
        <Link href="/billing?next=/dashboard/settings" className="block rounded-3xl border border-line bg-card px-4 py-4">
          <span className="font-medium">Twigigi billing</span>
          <span className="mt-1 block text-muted">The card or PayPal Twigigi uses for listing fees.</span>
        </Link>
        <Link href="/dashboard/help" className="block rounded-3xl border border-line bg-card px-4 py-4">
          <span className="font-medium">Help</span>
          <span className="mt-1 block text-muted">How orders and payments work.</span>
        </Link>
        <Link href="/dashboard/quotes" className="block rounded-3xl border border-line bg-card px-4 py-4 font-medium">Quotes</Link>
      </div>
    </main>
  );
}

export const metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading…</p>}>
      <SettingsScreen />
    </Suspense>
  );
}
