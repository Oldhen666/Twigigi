import { Suspense } from "react";
import { redirect } from "next/navigation";
import { saveProduct } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "@/components/product-form";
import { readCta } from "@/lib/format";

async function NewProduct({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const cta = readCta(typeof params.cta === "string" ? params.cta : undefined);
  if (!cta) redirect("/start");
  const title = cta === "buy" ? "New Product" : cta === "quote" ? "New Quote" : "New Contact";
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-serif text-4xl">{title}</h1>
      <ProductForm action={saveProduct} defaultEmail={user.email} sellerName={user.displayName} cta={cta} />
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
      <NewProduct searchParams={searchParams} />
    </Suspense>
  );
}
