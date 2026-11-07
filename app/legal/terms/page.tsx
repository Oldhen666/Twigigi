import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { SELLER_PAYMENT_RESPONSIBILITY, TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service" version={TERMS_VERSION}>
      <p>
        <strong>Effective Date:</strong> November 7, 2026<br />
        <strong>Website:</strong> <a href="https://twigigi.com" className="text-forest">https://twigigi.com</a><br />
        <strong>Platform Operator:</strong> Dybridge Trade Ltd.<br />
        <strong>Contact:</strong> <a href="mailto:contact@dybridge.com" className="text-forest">contact@dybridge.com</a>
      </p>

      <LegalSection title="1. Acceptance of Terms">
        <p>Welcome to Twigigi.</p>
        <p>These Terms of Service (&quot;Terms&quot;) govern your access to and use of Twigigi&apos;s website, product listings, order management tools, quotation features, and related services (collectively, the &quot;Platform&quot;).</p>
        <p>By creating an account, publishing a listing, placing an order, or otherwise using the Platform, you agree to these Terms and our <Link href="/legal/privacy" className="text-forest">Privacy Policy</Link>.</p>
        <p>If you do not agree, you must not use the Platform.</p>
        <p>You must be at least 18 years old, or the age of majority in your jurisdiction if higher, to enter into transactions through Twigigi.</p>
      </LegalSection>

      <LegalSection title="2. About Twigigi">
        <p>Twigigi is a platform that enables individuals and businesses to create and share product or service pages, receive purchase orders, manage inquiries, and communicate with potential customers.</p>
        <p>Twigigi is not the seller of products or services listed by independent sellers.</p>
        <p>Unless expressly stated otherwise:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Transactions are conducted directly between buyers and sellers.</li>
          <li>Sellers are responsible for their listings, pricing, availability, fulfillment, and customer service.</li>
          <li>Buyers pay sellers directly using the payment methods offered by each seller.</li>
          <li>Twigigi does not receive, hold, escrow, or guarantee buyer-to-seller payments.</li>
          <li>Twigigi does not guarantee the quality, legality, authenticity, availability, or delivery of listed products or services.</li>
        </ul>
        <p>Twigigi may provide order records, payment instructions, and transaction status tools. These features do not constitute payment processing, financial custody, or independent verification of payment.</p>
        <p>Nothing in these Terms excludes obligations or liabilities that cannot legally be excluded.</p>
      </LegalSection>

      <LegalSection title="3. User Accounts and Responsibilities">
        <p>Users agree to provide accurate and current information.</p>
        <p>Sellers are responsible for maintaining the security of their accounts and keeping their contact information and payment details accurate.</p>
        <p>Users must not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Impersonate another person or business.</li>
          <li>Provide fraudulent payment information.</li>
          <li>Publish misleading or deceptive listings.</li>
          <li>Engage in unlawful activities.</li>
          <li>Attempt to manipulate order records, payment confirmations, or reviews.</li>
          <li>Use Twigigi to distribute malware, infringe intellectual property rights, or facilitate prohibited transactions.</li>
        </ul>
        <p>Twigigi may restrict or suspend accounts that violate these Terms, subject to applicable law.</p>
      </LegalSection>

      <LegalSection title="4. Listings and Seller Obligations">
        <p>Sellers are responsible for ensuring that their listings accurately describe the products or services offered.</p>
        <p>This includes, where applicable:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Product condition, specifications, and availability.</li>
          <li>Pricing, currency, taxes, and additional charges.</li>
          <li>Pickup, shipping, or delivery arrangements.</li>
          <li>Service scope and expected completion dates.</li>
          <li>Applicable cancellation, return, and refund policies.</li>
          <li>Legal licenses, permits, and regulatory requirements.</li>
        </ul>
        <p>Sellers must comply with applicable consumer protection, product safety, tax, and advertising laws.</p>
        <p>Twigigi may remove listings that violate these Terms or applicable law.</p>
      </LegalSection>

      <LegalSection title="5. Orders and Transactions">
        <p>When a buyer places an order, Twigigi creates an electronic order record and may notify the seller.</p>
        <p>An order record does not, by itself, confirm that payment has been received or that goods or services have been delivered.</p>
        <p>Whether an order creates a binding purchase agreement between the buyer and seller depends on the applicable law, listing terms, and transaction circumstances.</p>
        <p>Sellers must honor applicable contractual obligations and promptly communicate any inability to fulfill an order.</p>
        <p>Buyers and sellers are responsible for coordinating any pickup, shipping, delivery, or service arrangements not already confirmed during checkout.</p>
      </LegalSection>

      <LegalSection title="6. Payments">
        <p>Twigigi supports seller-directed payment arrangements, which may include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cash on Pickup.</li>
          <li>Interac e-Transfer.</li>
          <li>Venmo.</li>
          <li>PayPal.</li>
          <li>Other payment methods expressly supported by the Platform.</li>
        </ul>
        <p>Payment availability depends on the seller&apos;s location, account eligibility, and Platform configuration.</p>
        <p>Payments for purchases are made directly to sellers, not to Twigigi.</p>
        <p>Buyers are responsible for verifying recipient information and payment amounts before transferring funds.</p>
        <p>Sellers are responsible for confirming that payments have actually been received.</p>
        <p>A buyer marking an order as &quot;Payment Sent&quot; does not establish that payment has been received.</p>
        <p>Likewise, an order reference or payment note does not independently verify a transaction.</p>
        <p>Third-party payment providers may apply their own fees, eligibility requirements, purchase protections, and terms.</p>
        <p>Twigigi does not guarantee that a third-party payment can be reversed or recovered.</p>
        <p><strong>Important:</strong> Sending money to an unfamiliar seller before receiving an item may involve financial risk. Buyers should exercise appropriate caution and use available payment protections where applicable.</p>
        <h3 id="seller-payment-responsibility" className="pt-2 font-medium">Seller responsibility for payment information</h3>
        {SELLER_PAYMENT_RESPONSIBILITY.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </LegalSection>

      <LegalSection title="7. Pickup, Delivery, and Fulfillment">
        <p>Sellers and buyers are responsible for arranging fulfillment in accordance with the listing and agreed order details.</p>
        <p>For Cash on Pickup transactions, payment is generally made when the item is collected, unless the parties lawfully agree otherwise.</p>
        <p>A requested pickup time is not necessarily confirmed unless it was offered as an available time or accepted by the seller.</p>
        <p>Sellers must provide accurate fulfillment information and comply with applicable delivery and consumer protection obligations.</p>
        <p>Twigigi does not independently inspect, transport, store, or deliver products unless expressly identified as the provider of such services.</p>
      </LegalSection>

      <LegalSection title="8. Cancellations, Returns, and Refunds">
        <p>Cancellation, return, and refund arrangements are primarily managed between buyers and sellers, subject to applicable law.</p>
        <p>Sellers must clearly disclose applicable policies and honor mandatory consumer rights.</p>
        <p>If a seller cannot fulfill an order, the seller is responsible for addressing any payment already received and providing any refund required by law or the applicable agreement.</p>
        <p>Twigigi does not ordinarily process refunds for payments made directly to sellers.</p>
        <p>Buyers may contact the seller or their payment provider regarding an unresolved payment or refund issue.</p>
        <p>Nothing in these Terms limits statutory cancellation, refund, warranty, or other consumer rights.</p>
      </LegalSection>

      <LegalSection title="9. Digital Products and Services">
        <p>Sellers offering digital products must have the necessary rights to distribute the content.</p>
        <p>Digital listings must accurately describe what buyers will receive, including relevant access restrictions, licenses, or download limitations.</p>
        <p>Where sellers provide digital files through external links, sellers remain responsible for access, delivery, and the security of their distribution method.</p>
        <p>Twigigi does not guarantee the continued availability of seller-hosted external content.</p>
        <p>Service providers are responsible for their professional qualifications, required licenses, work quality, and fulfillment obligations.</p>
      </LegalSection>

      <LegalSection title="10. Seller Fees and Subscriptions">
        <p>Twigigi may charge sellers fees for publishing or maintaining listings and using certain Platform features.</p>
        <p>Where applicable, the current standard listing subscription is:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>CAD $1.49 per month per listing for eligible Canadian listings.</li>
          <li>USD $1.49 per month per listing for eligible United States listings.</li>
          <li>CAD $1.49 per month per eligible digital listing.</li>
        </ul>
        <p>A qualifying quote request is CAD $0.25, or USD $0.25 for a United States listing, where displayed and applicable. Twigigi counts a quote when it is a valid new request and the seller can see it. The same buyer is not charged again for the same request on that Twig. Quote fees accumulate during the billing period and are included with the listing fee on the next monthly seller bill. Twigigi does not make a separate card charge for each quote.</p>
        <p>Actual prices, currency, taxes, billing frequency, and any applicable additional charges will be disclosed before purchase or subscription activation.</p>
        <p>If automatic recurring billing is enabled, Twigigi will disclose the recurring charge and renewal terms and obtain any consent required by law.</p>
        <p>Sellers may cancel recurring subscriptions through the cancellation process made available by Twigigi. Cancellation stops future renewals according to the disclosed billing terms and applicable law.</p>
        <p>Fees already incurred are generally non-refundable except where required by law or expressly stated in the applicable refund policy.</p>
        <p>Twigigi may change fees prospectively with appropriate notice and any consent required by law.</p>
      </LegalSection>

      <LegalSection title="11. Prohibited Products and Activities">
        <p>Users must not list or transact in products or services that violate applicable law or Twigigi&apos;s published policies.</p>
        <p>Prohibited activities include fraud, counterfeit goods, stolen property, unlawful financial services, illegal drugs, and other prohibited or restricted transactions.</p>
        <p>Twigigi may establish additional restrictions for regulated goods, hazardous products, adult content, weapons, and other categories.</p>
        <p>Sellers remain responsible for ensuring that their products and services may lawfully be offered in the relevant jurisdiction.</p>
      </LegalSection>

      <LegalSection title="12. Intellectual Property">
        <p>Twigigi and its associated names, logos, software, and Platform design are protected by applicable intellectual property laws.</p>
        <p>Sellers retain ownership of their original listing content.</p>
        <p>By uploading content, sellers grant Twigigi a non-exclusive, worldwide, royalty-free license to host, display, reproduce, and technically process that content as necessary to operate, maintain, and promote their listings and the Platform.</p>
        <p>Sellers represent that they have the rights necessary to provide this license.</p>
        <p>Users may not copy or exploit Twigigi&apos;s software, branding, or proprietary materials without authorization.</p>
      </LegalSection>

      <LegalSection title="13. Privacy and Communications">
        <p>Twigigi collects and processes personal information as described in its <Link href="/legal/privacy" className="text-forest">Privacy Policy</Link>.</p>
        <p>Users acknowledge that information necessary to process orders, inquiries, and fulfillment may be shared between the relevant buyer and seller.</p>
        <p>Users must use buyer and seller contact information only for legitimate transaction-related purposes or other purposes permitted by applicable law and valid consent.</p>
        <p>Twigigi may send transactional communications concerning orders, accounts, billing, and Platform security.</p>
        <p>Marketing communications are subject to applicable consent and unsubscribe requirements.</p>
      </LegalSection>

      <LegalSection title="14. Disputes Between Buyers and Sellers">
        <p>Buyers and sellers should first attempt to resolve transaction-related issues directly.</p>
        <p>Twigigi may provide communication tools, order records, reporting features, or discretionary assistance.</p>
        <p>Twigigi is not required to adjudicate every dispute and does not guarantee recovery of funds or successful resolution.</p>
        <p>Twigigi may investigate suspected fraud, suspend accounts, preserve relevant records, or cooperate with lawful requests from authorities.</p>
        <p>Nothing in these Terms prevents users from exercising applicable legal rights or contacting relevant consumer protection authorities.</p>
      </LegalSection>

      <LegalSection title="15. Platform Availability and Disclaimer">
        <p>Twigigi aims to provide a reliable and accessible service but does not guarantee uninterrupted or error-free operation.</p>
        <p>The Platform may experience maintenance, technical interruptions, or third-party service failures.</p>
        <p>To the extent permitted by applicable law, the Platform is provided on an &quot;as available&quot; basis without warranties beyond those expressly provided or required by law.</p>
        <p>Twigigi does not guarantee sales volume, customer demand, payment completion, or business results.</p>
      </LegalSection>

      <LegalSection title="16. Limitation of Liability">
        <p>To the maximum extent permitted by applicable law, Twigigi is not responsible for losses arising solely from the independent acts or omissions of buyers, sellers, or third-party payment providers.</p>
        <p>Twigigi will not be liable for indirect, incidental, special, or consequential damages to the extent such exclusions are legally permitted.</p>
        <p>Nothing in these Terms excludes liability for fraud, willful misconduct, or other liability that cannot lawfully be excluded, or restricts mandatory consumer rights.</p>
      </LegalSection>

      <LegalSection title="17. Account Suspension and Termination">
        <p>Users may stop using Twigigi and may request account closure through the available account controls or support channels.</p>
        <p>Twigigi may suspend or terminate access for material violations of these Terms, suspected fraud, security threats, or legal requirements.</p>
        <p>Where reasonably appropriate, Twigigi may provide notice and an opportunity to address the issue.</p>
        <p>Termination does not eliminate outstanding payment obligations, existing contractual responsibilities, or provisions that reasonably survive termination.</p>
      </LegalSection>

      <LegalSection title="18. Changes to These Terms">
        <p>Twigigi may update these Terms to reflect changes in the Platform, business practices, or applicable law.</p>
        <p>The updated version will display its effective date.</p>
        <p>Where required by law, Twigigi will provide advance notice or obtain consent before material changes take effect.</p>
        <p>Changes will not retroactively eliminate rights or obligations arising from completed transactions where prohibited by law.</p>
      </LegalSection>

      <LegalSection title="19. Governing Law">
        <p>Subject to mandatory consumer protection laws and other applicable jurisdictional requirements, these Terms are governed by the laws of the Province of Alberta and the applicable federal laws of Canada.</p>
        <p>Nothing in this section prevents consumers from exercising rights available under the mandatory laws of their jurisdiction.</p>
      </LegalSection>

      <LegalSection title="20. Contact Information">
        <p>For questions about these Terms or the Platform, contact:</p>
        <p>
          <strong>Twigigi</strong><br />
          Operated by: Dybridge Trade Ltd.<br />
          Email: <a href="mailto:contact@dybridge.com" className="text-forest">contact@dybridge.com</a><br />
          Website: <a href="https://twigigi.com" className="text-forest">https://twigigi.com</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
