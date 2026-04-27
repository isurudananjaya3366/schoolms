import nodemailer from "nodemailer";
import { getSecureSetting } from "@/lib/secure-settings";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendEmailOptions): Promise<void> {
  // Fetch API keys from secure settings
  const resendApiKey = await getSecureSetting("RESEND_API_KEY");
  const smtpHost = await getSecureSetting("SMTP_HOST");
  const emailFrom =
    (await getSecureSetting("EMAIL_FROM")) ||
    process.env.EMAIL_FROM ||
    "SchoolMS <noreply@schoolms.app>";

  // Strategy 1: Resend
  if (resendApiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      })),
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
      from: emailFrom,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return;
  }

  // Strategy 3: Dev fallback - console output
  console.warn(
    "[sendEmail] No email provider configured (RESEND_API_KEY or SMTP_HOST). Logging email to console."
  );
  console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
}
