import nodemailer from "nodemailer";

export async function sendResetEmail(to: string, url: string) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) throw new Error("SMTP is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: pass ?? "" } : undefined,
  });
  await transport.sendMail({
    from,
    to,
    subject: "Reset your Twigigi password",
    text: `Reset your Twigigi password with this link. It expires in one hour.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}
