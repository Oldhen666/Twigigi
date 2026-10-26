import Link from "next/link";
import { Suspense } from "react";
import { ResetForm } from "@/components/password-forms";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

async function ResetScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-6">
        <BackButton />
        <h1 className="mt-8 font-serif text-4xl">Choose a new password</h1>
        <div className="mt-6">
          {token ? <ResetForm token={token} /> : <p className="text-sm text-danger">This reset link is invalid or expired.</p>}
        </div>
        <p className="mt-4 text-sm text-muted">
          <Link href="/forgot" className="text-forest">Send a new link</Link>
        </p>
      </div>
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <ResetScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "New password", robots: { index: false, follow: false } };
