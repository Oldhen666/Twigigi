import { listPendingBillingNotices, markNoticeResult, markNoticeSending } from "@/lib/db";
import { sendOrderEmail } from "@/lib/mail";

export async function deliverBillingNotices() {
  const pending = listPendingBillingNotices();
  let sent = 0;
  for (const notice of pending) {
    if (!markNoticeSending(notice.id)) continue;
    let ok = false;
    try {
      ok = await sendOrderEmail(notice.email, { subject: notice.subject, text: notice.body });
    } catch (error) {
      console.error("Billing notice was not sent.", error instanceof Error ? error.name : "");
      ok = false;
    }
    markNoticeResult(notice.id, ok);
    if (ok) sent += 1;
  }
  return sent;
}
