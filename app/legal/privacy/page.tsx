import { LegalPage, LegalSection } from "@/components/legal-page";
import { PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" version={PRIVACY_VERSION}>
      <LegalSection title="Who this covers">
        <p>This policy describes how the Twigigi platform handles personal information when you create an account, publish a listing, place or receive an order or quote, or send a report. It is not legal advice.</p>
      </LegalSection>
      <LegalSection title="Information we handle">
        <p>Account information includes your name, username, email address, and password hash. Listing information includes what you choose to publish, such as titles, descriptions, photos, prices, locations, and contact details. Orders, quotes, and messages include the details the buyer and seller submit so they can complete that request.</p>
        <p>If you report a listing or an intellectual-property concern, Twigigi stores the report, your contact details, and the explanation and evidence you provide. A signed-in like is stored with your account. A like without an account is stored with a random visitor cookie on your browser so the same browser is not counted twice. Twigigi also uses a session cookie to keep you signed in.</p>
      </LegalSection>
      <LegalSection title="How it is used">
        <p>Twigigi uses this information to operate accounts, show listings, deliver order and quote notices, review reports, keep the platform secure, and record acceptance of the Terms and this policy. Payment details you enter for a seller, such as an Interac address, are shown to buyers as part of that listing. Twigigi does not sell personal information as a product.</p>
        <p>The other person in an order, quote, or message receives the contact details needed for that exchange. A service provider that hosts the platform, sends email, or processes a Twigigi subscription may handle the information required for that task.</p>
      </LegalSection>
      <LegalSection title="How long it is kept">
        <p>Twigigi keeps account, listing, order, and report records for as long as needed to operate the platform, resolve a dispute, or meet a legal obligation. You can deactivate a listing from your selling page where that control is offered. Removing a listing does not erase an order or a report that already exists.</p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>You can update your name and username from your account. You can stop using a visitor cookie by clearing cookies for this site; likes stored only on that cookie will no longer be tied to the browser. To ask a question about this policy, use the contact shown in your account help.</p>
      </LegalSection>
      <LegalSection title="Alberta">
        <p>Twigigi is operated in connection with Alberta, Canada. This policy does not limit a privacy right that applicable law gives you and does not allow to be waived.</p>
      </LegalSection>
    </LegalPage>
  );
}
