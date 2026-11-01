import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { PROHIBITED_CATEGORIES } from "@/lib/legal";

export const metadata = { title: "Prohibited Items" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Prohibited Items" version="2026-10-31">
      <LegalSection title="What you may not list">
        <p>Twigigi is a place for users to publish their own products, services, and requests. Some categories are not allowed. The categories below can be extended as the platform’s rules change. They are not a complete list of every law that may apply to you.</p>
      </LegalSection>
      {PROHIBITED_CATEGORIES.map((category) => (
        <LegalSection key={category.id} title={category.title}>
          <p>{category.body}</p>
        </LegalSection>
      ))}
      <LegalSection title="How Twigigi applies this policy">
        <p>Twigigi may restrict a listing or an account when it reasonably believes the listing or account violates the law, someone else’s rights, or this policy. That decision is a moderation decision. It is not a finding by a court. Where it is appropriate, Twigigi may restore a listing.</p>
        <p>Anyone can <Link href="/legal/report-infringement" className="text-forest">report intellectual property infringement</Link>, or use Report listing on a public Twig for other concerns. A report does not by itself remove the listing.</p>
      </LegalSection>
    </LegalPage>
  );
}
