import { NextRequest, NextResponse } from "next/server";

const CONTACT_EMAILS = ["isaac@notibuy.com", "cody@notibuy.com"];

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

    // Log the contact submission (for now, until an email service is configured)
    console.log("=== New Contact Submission ===");
    console.log(`Type: ${type}`);
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Company: ${company || "N/A"}`);
    console.log(`Phone: ${phone || "N/A"}`);
    console.log(`Message: ${message}`);
    console.log(`Recipients: ${CONTACT_EMAILS.join(", ")}`);
    console.log("==============================");

    // TODO: Integrate with an email service (Resend, SendGrid, etc.)
    // Example with Resend:
    //
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    //
    // await resend.emails.send({
    //   from: 'VeriBuy <noreply@getveribuy.com>',
    //   to: CONTACT_EMAILS,
    //   subject: type === 'demo'
    //     ? `[VeriBuy] Demo Request from ${name} at ${company}`
    //     : `[VeriBuy] Meeting Request from ${name} at ${company}`,
    //   html: `
    //     <h2>New ${type === 'demo' ? 'Demo' : 'Meeting'} Request</h2>
    //     <p><strong>Name:</strong> ${name}</p>
    //     <p><strong>Email:</strong> ${email}</p>
    //     <p><strong>Company:</strong> ${company || 'N/A'}</p>
    //     <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
    //     <p><strong>Message:</strong> ${message}</p>
    //   `,
    // });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
