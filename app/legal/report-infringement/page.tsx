import { Suspense } from "react";
import { IpReportForm } from "@/components/ip-report-form";
import { LegalPage } from "@/components/legal-page";
import { getCurrentUser } from "@/lib/auth";
import { IP_POLICY_VERSION } from "@/lib/legal";

export const metadata = { title: "Report intellectual property infringement" };

async function ReportScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const url = typeof params.url === "string" ? params.url : "";
  const user = await getCurrentUser();
  return (
    <LegalPage eyebrow="Legal" title="Report intellectual property infringement" version={IP_POLICY_VERSION}>
      <p>Use this form if you own a right, or you are authorized to act for the owner, and you believe a listing on Twigigi infringes it. Twigigi will review the report. The listing stays up unless a reviewer later restricts it.</p>
      <IpReportForm defaultName={user?.displayName ?? ""} defaultEmail={user?.email ?? ""} defaultUrl={url} />
    </LegalPage>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <ReportScreen searchParams={searchParams} />
    </Suspense>
  );
}
