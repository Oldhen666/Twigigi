import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { userHasTwigs } from "@/lib/db";
import { readCta } from "@/lib/format";

async function SignupScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cta = readCta(typeof params.cta === "string" ? params.cta : undefined);
  const user = await getCurrentUser();
  if (user) redirect(cta ? `/dashboard/products/new?cta=${cta}` : userHasTwigs(user.id) ? "/dashboard" : "/orders");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <BackButton />
      <div className="flex flex-1 flex-col justify-center py-6">
      <Logo />
      <h1 className="mt-8 font-serif text-4xl">Create an account</h1>
      <p className="mt-2 text-muted">One account for your orders, saved Twigs, and anything you publish.</p>
      <div className="mt-6">
        <SignupForm cta={cta ?? undefined} />
      </div>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link href="/login" className="text-forest">Log in</Link>
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
      <SignupScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Sign up" };
