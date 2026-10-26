import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { BackButton } from "@/components/back-button";
import { saveProduct } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { readCta } from "@/lib/format";

async function NewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cta = readCta(typeof params.cta === "string" ? params.cta : undefined);
  if (!cta) redirect("/start");
  const user = await getCurrentUser();
  if (user) redirect(`/dashboard/products/new?cta=${cta}`);
  const title = cta === "buy" ? "New Product" : cta === "quote" ? "New Quote" : "New Contact";
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <BackButton />
        <Link href={`/login?next=${encodeURIComponent(`/new?cta=${cta}`)}`} className="text-sm text-ink hover:text-forest">
          Sign in
        </Link>
      </div>
      <h1 className="mt-4 font-serif text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Build the Twig now. Your profile is created when you publish.</p>
      <ProductForm action={saveProduct} defaultEmail="" sellerName="" cta={cta} guest />
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading editor…</p>}>
      <NewPage searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Create a Twig" };
