import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { RespondChoice } from "@/components/respond-choice";
import { getCurrentUser } from "@/lib/auth";

async function StartScreen() {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <BackButton />
      <div className="mt-8">
        <RespondChoice signedIn={Boolean(user)} />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <StartScreen />
    </Suspense>
  );
}

export const metadata = { title: "How should buyers respond?" };
