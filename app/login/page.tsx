import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm, LoginHelp } from "@/components/auth-forms";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";

async function LoginScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-6">
      <BackButton />
      <h1 className="mt-8 font-serif text-4xl">Log in</h1>
      <div className="mt-6">
        <LoginForm nextPath={nextPath} />
      </div>
      <p className="mt-4 text-sm text-muted">
        New here? <Link href="/signup" className="text-forest">Create a Twigigi account</Link>
      </p>
      <LoginHelp />
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
      <LoginScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Log in", robots: { index: false, follow: false } };
