import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { COPYRIGHT_POLICY_VERSION } from "@/lib/legal";

export const metadata = { title: "Copyright Policy" };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Copyright Policy" version={COPYRIGHT_POLICY_VERSION}>
      <LegalSection title="Copyright and seller responsibility">
        <p>Only upload or link to digital products that you own or are authorized to sell and distribute.</p>
        <p>You are responsible for ensuring that your files, product images, descriptions, and linked content do not infringe any third party’s copyright, trademark, or other intellectual property rights. Purchasing or downloading a file does not, by itself, give you permission to resell or redistribute it. AI-generated or modified content must also comply with these requirements.</p>
        <p>You must clearly describe the buyer’s permitted use, including any restrictions on commercial use, modification, redistribution, or resale.</p>
        <p>Twigigi provides tools for sellers to list and share digital products. A listing’s availability on Twigigi does not constitute verification of ownership, authorization, or legal compliance.</p>
        <p>Twigigi may request proof of ownership or authorization, remove or disable access to listings or files, and suspend or terminate accounts in response to suspected infringement or violations of its policies.</p>
      </LegalSection>
      <LegalSection title="Copyright violations and enforcement">
        <p>If Twigigi receives a credible infringement report or reasonably suspects a violation, it may take one or more of the following actions, depending on the nature, severity, and history of the issue.</p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Request supporting documents. Twigigi may require evidence of ownership or authorization, such as original source files, licensing agreements, or written permission from the rights holder. Unless otherwise stated in the notice, the seller must respond within seven calendar days. A listing may remain disabled during review.</li>
          <li>Remove or restrict content. Twigigi may temporarily or permanently remove listings, disable access to hosted files or delivery links, and restrict further sales or distribution through Twigigi. Twigigi may act immediately without prior notice where reasonably necessary. Twigigi cannot delete a file stored outside Twigigi, or a copy a buyer has already downloaded.</li>
          <li>Restrict or suspend accounts. Twigigi may issue a warning, restrict publishing privileges, or temporarily suspend the seller’s account. Failure to respond, resolve the issue, or provide adequate supporting documents may result in further restrictions.</li>
          <li>Terminate accounts for repeated or serious violations. Repeated infringement, deliberate distribution of unauthorized content, forged authorization documents, or attempts to bypass enforcement may result in permanent account termination. Serious violations may result in termination without a prior warning. Twigigi does not use a fixed number of reports as an automatic ban.</li>
          <li>Prevent circumvention. Sellers must not re-upload removed content, replace its delivery link, or use another listing or account to bypass restrictions. Doing so may result in the removal of related listings and suspension or termination of accounts used to evade enforcement.</li>
          <li>Address affected transactions. Twigigi may cancel affected orders or restrict pending delivery where technically possible and permitted by law. Any refunds will be handled under applicable law, Twigigi’s refund policies, and the relevant payment provider’s rules. Sellers remain responsible for refunds and other obligations attributable to their violations. Twigigi does not automatically refund, charge, or freeze funds under this policy.</li>
          <li>Allow review requests. Sellers who believe an action was taken in error may <Link href="/legal/copyright-appeal" className="text-forest">request a review</Link> and provide supporting evidence. A review request does not automatically restore a listing or account. This form is not a statutory counter-notice, and Twigigi does not claim to have registered a DMCA agent. Any applicable statutory notice process takes precedence.</li>
          <li>Handle abusive reports. Knowingly submitting false infringement reports or fabricated evidence may result in account restrictions or termination.</li>
        </ol>
        <p>Twigigi’s enforcement decisions concern access to its services and do not constitute a court determination of infringement. Nothing in this policy limits rights or obligations under applicable law.</p>
        <p>To report a listing, use the <Link href="/legal/report-infringement" className="text-forest">infringement report</Link>. Reports are reviewed by an administrator. They are not shown in full to the other party.</p>
      </LegalSection>
    </LegalPage>
  );
}
