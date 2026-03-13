import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function getContactEmails(): string[] {
  return [
    process.env.CONTACT_EMAIL_1,
    process.env.CONTACT_EMAIL_2,
  ].filter(Boolean) as string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, phone, message, type } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const isDemo = type === "demo";
    const subject = isDemo
      ? `[VeriBuy] Demo Request from ${name}${company ? ` at ${company}` : ""}`
      : `[VeriBuy] Contact from ${name}${company ? ` at ${company}` : ""}`;

    const resend = getResend();

    await resend.emails.send({
      from: "VeriBuy <noreply@getveribuy.com>",
      to: getContactEmails(),
      replyTo: email,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111; border-bottom: 2px solid #7c3aed; padding-bottom: 12px;">
            New ${isDemo ? "Demo" : "Contact"} Request
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 100px;">Name</td>
              <td style="padding: 8px 0; color: #111; font-weight: 500;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #7c3aed;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Company</td>
              <td style="padding: 8px 0; color: #111;">${company || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Phone</td>
              <td style="padding: 8px 0; color: #111;">${phone || "N/A"}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <p style="color: #666; margin: 0 0 8px 0; font-size: 13px;">Message</p>
            <p style="color: #111; margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #999;">
            Sent from getveribuy.com contact form
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
