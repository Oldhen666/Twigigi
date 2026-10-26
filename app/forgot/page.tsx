import Link from "next/link";
import { ForgotForm } from "@/components/password-forms";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-6">
        <BackButton />
        <h1 className="mt-8 font-serif text-4xl">Reset password</h1>
        <p className="mt-2 text-sm text-muted">Enter the email on the account. We will send a link that expires in one hour.</p>
        <div className="mt-6">
          <ForgotForm />
        </div>
        <p className="mt-4 text-sm text-muted">
          <Link href="/login" className="text-forest">Back to log in</Link>
        </p>
      </div>
    </main>
  );
}

export const metadata = { title: "Reset password", robots: { index: false, follow: false } };
