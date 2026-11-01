import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service" version={TERMS_VERSION}>
      <LegalSection title="Platform role">
        <p>Twigigi provides technology that lets people publish listings, request quotes, discover what others have posted, and communicate about those listings. Unless Twigigi expressly says that it is the seller or provider of a particular listing, Twigigi is not the manufacturer, supplier, seller, contractor, employer, agent, representative, or professional service provider for a user listing.</p>
        <p>Products, services, buy requests, quotes, prices, photos, and descriptions come from users. A transaction is between the users who choose to deal with each other.</p>
      </LegalSection>
      <LegalSection title="Agreement">
        <p>By creating an account, publishing a listing, or using Twigigi, you agree to these Terms and the <Link href="/legal/privacy" className="text-forest">Privacy Policy</Link>. If you use Twigigi for a business, you confirm that you have authority to bind that business.</p>
      </LegalSection>
      <LegalSection title="Eligibility and accounts">
        <p>You must be able to form a contract to create an account. You are responsible for the accuracy of your account details, for keeping your password confidential, and for activity under your account. Tell Twigigi if you believe your account is being used without permission.</p>
      </LegalSection>
      <LegalSection title="User content">
        <p>You keep ownership of the text, photos, videos, logos, designs, documents, and other materials you submit (“User Content”). You grant Twigigi a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, format, resize, display, distribute, and otherwise use that User Content as reasonably necessary to operate, secure, improve, and promote Twigigi and your listing. This licence ends when the User Content is removed from the platform, except for copies kept as reasonably necessary for security, dispute resolution, legal compliance, or backup. This licence does not transfer ownership of your User Content to Twigigi.</p>
      </LegalSection>
      <LegalSection title="Listings, requests, and quotes">
        <p>You are responsible for product listings, service listings, buy requests, and quotes you create. That includes the title, price, description, photos, availability, and any claim about what a buyer will receive. Quotes and messages are offers or inquiries between users. Twigigi does not set those prices and does not promise that another user will accept them.</p>
        <p>Listing information is provided by the person who posted it. Twigigi does not endorse a listing because it appears on the platform.</p>
      </LegalSection>
      <LegalSection title="User-to-user transactions">
        <p>Payment, pickup, delivery, performance of a service, and completion of an order are arranged by the users involved. Twigigi may display the payment methods a seller has chosen and may send notices about an order. That does not make Twigigi a party to the sale or the service, and it does not make Twigigi responsible for the quality, safety, legality, or delivery of what was listed.</p>
      </LegalSection>
      <LegalSection title="Seller and service-provider responsibilities">
        <p>If you publish a listing, you are responsible for having the right to sell or offer what you list, for performing what you agree with a buyer, and for the accuracy of the listing. You are also responsible for licences, permits, insurance, taxes, and other regulatory requirements that apply to your product, service, or business. Twigigi does not obtain those for you and does not decide whether your activity is licensed.</p>
      </LegalSection>
      <LegalSection title="Prohibited activity">
        <p>You may not use Twigigi to break the law, infringe someone else’s rights, mislead other users, or post a prohibited listing. The <Link href="/legal/prohibited-items" className="text-forest">Prohibited Items</Link> policy describes categories Twigigi does not allow. Twigigi may restrict a listing or an account that it reasonably believes violates the law, someone else’s rights, or Twigigi’s policies.</p>
      </LegalSection>
      <LegalSection title="Intellectual property">
        <p>You may only upload or publish content you own or are authorized to use. The <Link href="/legal/intellectual-property" className="text-forest">Intellectual Property</Link> policy explains that rule, including trademarks and brand names that belong to other people. Twigigi does not check the ownership of every upload. A rights holder can <Link href="/legal/report-infringement" className="text-forest">report infringement</Link>. Twigigi may review a report and restrict content. Sending a report does not by itself remove a listing.</p>
        <p>Names, logos, and product images of third parties may appear in user listings. Their appearance does not mean that the owner endorses, sponsors, authorizes, or is affiliated with Twigigi or the seller. If Twigigi later confirms a seller’s identity or business, that confirmation is not a statement that a product is authentic.</p>
      </LegalSection>
      <LegalSection title="Accounts and content removal">
        <p>Twigigi may suspend or close an account, or restrict or remove a listing, where it reasonably believes that is needed to enforce these Terms, respond to a legal concern, or protect users or the platform. Twigigi will not treat every complaint as proven. Where it is reasonable, Twigigi may restore a listing or an account.</p>
      </LegalSection>
      <LegalSection title="Disputes between users">
        <p>Disagreements about a product, service, quote, payment, or delivery are between the users involved. Twigigi may share information those users already provided, such as an order notice, but is not required to resolve the dispute or to refund a payment a seller received directly.</p>
      </LegalSection>
      <LegalSection title="Platform availability">
        <p>Twigigi may change, pause, or discontinue features. The platform may be unavailable from time to time. Twigigi does not promise uninterrupted or error-free operation.</p>
      </LegalSection>
      <LegalSection title="Disclaimer of warranties">
        <p>To the maximum extent permitted by applicable law, Twigigi is provided “as is” and “as available”, without warranties of merchantability, fitness for a particular purpose, title, or non-infringement, and without a warranty that listings are accurate, lawful, or still available. Some jurisdictions do not allow certain warranty disclaimers, and those limits apply only as far as the law allows.</p>
      </LegalSection>
      <LegalSection title="Limitation of liability">
        <p>To the maximum extent permitted by applicable law, Twigigi and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, goodwill, or business, arising out of the platform, user content, or a transaction between users. To the maximum extent permitted by applicable law, Twigigi’s total liability for claims relating to the platform is limited to the greater of the fees you paid Twigigi for the platform service giving rise to the claim during the three months before the claim, or one hundred Canadian dollars.</p>
        <p>These limits do not apply to liability that applicable law does not allow to be limited or excluded, including any mandatory consumer right.</p>
      </LegalSection>
      <LegalSection title="Indemnification">
        <p>To the maximum extent permitted by applicable law, you will indemnify Twigigi and its operators against claims, damages, and reasonable expenses arising out of your User Content, your listings, your transactions with other users, or your breach of these Terms or of someone else’s rights. This does not require you to indemnify Twigigi for Twigigi’s own fraud or for liability that applicable law does not allow to be shifted to you.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>Twigigi may update these Terms. The version date on this page will change. If you continue to use Twigigi after an update applies, the updated Terms apply to your later use. Twigigi may ask you to accept a new version before you publish again.</p>
      </LegalSection>
      <LegalSection title="Termination">
        <p>You may stop using Twigigi and may deactivate listings from your account where that control is offered. Twigigi may suspend or end access as described above. Sections that by their nature should continue, including ownership of User Content, the content licence for copies already made, disclaimers, liability limits, and indemnification, continue after termination to the extent applicable law allows.</p>
      </LegalSection>
      <LegalSection title="Governing law">
        <p>These Terms are governed by the laws of the Province of Alberta and the federal laws of Canada applicable in Alberta, excluding conflict-of-law rules that would apply another jurisdiction’s law. This choice does not deprive you of a mandatory law or consumer right that applies to you and cannot be waived. The courts of Alberta have jurisdiction over disputes about these Terms, except where a mandatory law requires a different forum.</p>
      </LegalSection>
    </LegalPage>
  );
}
