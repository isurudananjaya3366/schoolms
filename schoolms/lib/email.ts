import nodemailer from "nodemailer";
import { getSecureSetting } from "@/lib/secure-settings";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<void> {
  // Fetch API keys from secure settings
  const resendApiKey = await getSecureSetting("RESEND_API_KEY");
  const smtpHost = await getSecureSetting("SMTP_HOST");

  // Strategy 1: Resend
  if (resendApiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "SchoolMS <noreply@schoolms.app>",
      to,
      subject,
      html,
      text,
    });
    return;
  }

  // Strategy 2: SMTP via Nodemailer
  if (smtpHost) {
    const smtpPort = await getSecureSetting("SMTP_PORT");
    const smtpUser = await getSecureSetting("SMTP_USER");
    const smtpPass = await getSecureSetting("SMTP_PASS");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "SchoolMS <noreply@schoolms.app>",
      to,
      subject,
      html,
      text,
    });
    return;
  }

  // Strategy 3: Dev fallback — console output
  console.warn(
    "[sendEmail] No email provider configured (RESEND_API_KEY or SMTP_HOST). Logging email to console."
  );
  console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
}
