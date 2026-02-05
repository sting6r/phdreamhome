import nodemailer from "nodemailer";
export function getTransport() {
  if (!process.env.SMTP_HOST) {
    return nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}
export async function sendEmail(to: string, subject: string, html: string, cc?: string | string[]) {
  const transporter = getTransport();
  console.log(`Mailer: Sending email to ${to}... (SMTP_HOST: ${process.env.SMTP_HOST || "none"})`);
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "no-reply@example.com",
    to,
    cc,
    subject,
    text: html.replace(/\u003c[^\u003e]*\u003e/g, ""),
    html,
  });
  if (!process.env.SMTP_HOST && (info as any).message) {
    console.log("Mailer: DEV MODE (streamTransport). Email content:");
    console.log((info as any).message.toString());
  }
  return info;
}
export async function sendVerificationEmail(to: string, url: string) {
  return sendEmail(to, "Verify your email", `<p>Click the link to verify your email:</p><p><a href="${url}">${url}</a></p>`);
}
