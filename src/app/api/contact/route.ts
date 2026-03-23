import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, role, message } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Send notification email to founders
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "VeriBuy <noreply@getveribuy.com>",
        to: ["isaac@notibuy.com", "cody@notibuy.com"],
        subject: `[VeriBuy] Meeting Request from ${name}${company ? ` at ${company}` : ""}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff4289, #be00a4, #5c0099); padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 20px;">New Meeting Request</h2>
            </div>
            <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Name</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;"><a href="mailto:${email}" style="color: #5c0099;">${email}</a></td>
                </tr>
                ${company ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Dealership</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${company}</td></tr>` : ""}
                ${role ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Role</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${role}</td></tr>` : ""}
                ${message ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Message</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${message}</td></tr>` : ""}
              </table>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <a href="mailto:${email}" style="display: inline-block; background: linear-gradient(135deg, #ff4289, #be00a4, #5c0099); color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Reply to ${name.split(" ")[0]}</a>
              </div>
            </div>
          </div>
        `,
      });
    } else {
      // Fallback: log to console if Resend is not configured
      console.log("=== New Meeting Request ===");
      console.log(`Name: ${name}`);
      console.log(`Email: ${email}`);
      console.log(`Company: ${company || "N/A"}`);
      console.log(`Role: ${role || "N/A"}`);
      console.log(`Message: ${message || "N/A"}`);
      console.log("===========================");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
