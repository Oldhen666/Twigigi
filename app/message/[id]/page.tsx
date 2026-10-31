import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Stage } from "@/components/stage";
import { getMessage } from "@/lib/db";

async function MessageView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const message = getMessage(id);
  if (!message) notFound();
  return (
    <Stage>
      <div className="bg-card px-6 py-10 sm:rounded-[28px]">
        <p className="text-sm text-clay">Message sent</p>
        <h1 className="mt-2 font-serif text-4xl">{message.productTitle}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          The seller has your message and can reply at {message.email}. No account was created.
        </p>
        <Link href={`/${message.publicId}/${message.productSlug}`} className="mt-8 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">
          Back to the product
        </Link>
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <MessageView params={params} />
    </Suspense>
  );
}

export const metadata = { title: "Message sent", robots: { index: false, follow: false } };
