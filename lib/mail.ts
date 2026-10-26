import nodemailer from "nodemailer";

function mailbox() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) return null;
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

export async function sendOrderEmail(to: string, message: { subject: string; text: string }) {
  const box = mailbox();
  if (!box) return false;
  try {
    await box.transport.sendMail({ from: box.from, to, subject: message.subject, text: message.text });
    return true;
  } catch {
    return false;
  }
}
