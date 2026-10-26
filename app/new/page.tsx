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
      <BackButton />
      <h1 className="mt-4 font-serif text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Save draft or Publish creates your seller account. Your name and link are created then, and what you already filled in stays on this page.</p>
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
