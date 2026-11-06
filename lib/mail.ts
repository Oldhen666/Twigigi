import nodemailer from "nodemailer";

let warned = false;

function mailbox() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    if (!warned) {
      warned = true;
      console.error("Twigigi email is off. Set SMTP_HOST and SMTP_FROM, then restart.");
    }
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: pass ?? "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    }),
  };
}

export async function sendResetEmail(to: string, url: string) {
  const box = mailbox();
  if (!box) throw new Error("SMTP is not configured");
  await box.transport.sendMail({
    from: box.from,
    to,
    subject: "Reset your Twigigi password",
    text: `Reset your Twigigi password with this link. It expires in one hour.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}

export async function sendOrderEmail(to: string | string[], message: { subject: string; text: string; replyTo?: string }) {
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const box = mailbox();
  if (!box || recipients.length === 0) return false;
  try {
    await box.transport.sendMail({
      from: box.from,
      to: recipients,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
    });
    return true;
  } catch (error) {
    console.error("Order email failed.", error instanceof Error ? error.message : error);
    return false;
  }
}
