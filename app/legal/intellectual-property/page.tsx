import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { IP_POLICY_VERSION } from "@/lib/legal";

export const metadata = { title: "Intellectual Property" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Intellectual Property" version={IP_POLICY_VERSION}>
      <LegalSection title="Your content">
        <p>You may upload or publish content only if you own it or have permission to use it. User Content includes photos, videos, product images, logos, trademarks, brand names, artwork, graphics, designs, documents, written descriptions, 3D models, and other materials you submit.</p>
        <p>You represent that your User Content does not infringe another person’s copyright, trademark, patent, industrial design, trade secret, privacy or publicity rights, or other proprietary rights.</p>
        <p>You keep ownership of your User Content. The licence you give Twigigi is described in the <Link href="/legal/terms" className="text-forest">Terms of Service</Link>. It is limited to operating, securing, improving, and promoting Twigigi and your listing. It does not transfer ownership to Twigigi.</p>
      </LegalSection>
      <LegalSection title="What Twigigi does not do">
        <p>Twigigi does not verify the ownership of every uploaded item. A listing appearing on Twigigi is not a statement that the product is authentic, that the seller owns a brand, or that a rights holder has approved the listing.</p>
      </LegalSection>
      <LegalSection title="Trademarks and brands">
        <p>Third-party trademarks, logos, brand names, and product images may belong to their respective owners. Their use in a listing does not imply that the owner endorses, sponsors, authorizes, partners with, or is affiliated with Twigigi or the seller.</p>
        <p>If Twigigi confirms an account holder’s identity or business, that is an identity or business confirmation only. It is not a statement that a product is authentic.</p>
      </LegalSection>
      <LegalSection title="Reports">
        <p>If you believe a listing infringes a right you own or are authorized to enforce, submit a <Link href="/legal/report-infringement" className="text-forest">report of intellectual property infringement</Link>. A report is a request for review. Twigigi does not delete a listing merely because a report was submitted.</p>
        <p>Twigigi may investigate a report and may restrict, disable, or remove content that it reasonably believes infringes a right or violates this policy. Twigigi may also suspend or terminate an account for repeated or serious infringement. Twigigi may reject a report that does not describe the right or the listing, or that it does not believe is substantiated.</p>
      </LegalSection>
    </LegalPage>
  );
}
