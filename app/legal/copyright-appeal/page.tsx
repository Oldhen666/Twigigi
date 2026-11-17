import { Suspense } from "react";
import Link from "next/link";
import { CopyrightAppealForm } from "@/components/copyright-appeal-form";
import { LegalPage } from "@/components/legal-page";
import { getCurrentUser } from "@/lib/auth";
import { sellerProducts } from "@/lib/db";
import { COPYRIGHT_POLICY_VERSION } from "@/lib/legal";

export const metadata = { title: "Request a copyright review" };

async function AppealScreen() {
  const user = await getCurrentUser();
  const products = user ? sellerProducts(user.id).filter((product) => product.cta === "file").map((product) => ({ id: product.id, title: product.title })) : [];
  return (
    <LegalPage eyebrow="Legal" title="Request a review" version={COPYRIGHT_POLICY_VERSION}>
      <p>Use this form if you are the seller and you believe Twigigi restricted a digital file, listing, or account in error. This is not a statutory counter-notice. A request does not restore access by itself.</p>
      {user ? <CopyrightAppealForm products={products} /> : <p className="mt-6 text-sm">Sign in to your seller account, then return to this page. <Link href="/login" className="text-forest">Sign in</Link></p>}
    </LegalPage>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <AppealScreen />
    </Suspense>
  );
}
