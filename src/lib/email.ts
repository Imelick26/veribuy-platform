import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "VeriBuy <noreply@getveribuy.com>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  orgName: string;
  tempPassword: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `You've been added to ${opts.orgName} on VeriBuy`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="margin: 0 0 8px;">Welcome to VeriBuy, ${opts.name}!</h2>
        <p style="color: #555; margin: 0 0 24px;">You've been added to <strong>${opts.orgName}</strong>. Use the credentials below to sign in.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #777;">Email</p>
          <p style="margin: 0 0 16px; font-weight: 600;">${opts.to}</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #777;">Temporary Password</p>
          <p style="margin: 0; font-family: monospace; font-size: 18px; font-weight: 600; letter-spacing: 1px;">${opts.tempPassword}</p>
        </div>
        <p style="color: #555; font-size: 14px; margin: 0 0 8px;">Please change your password after signing in by going to <strong>Settings</strong>.</p>
        <p style="color: #999; font-size: 12px; margin: 24px 0 0;">&mdash; VeriBuy Vehicle Inspection Intelligence</p>
      </div>
    `,
  });
}

export async function sendUpgradeRequestEmail(opts: {
  orgName: string;
  orgId: string;
  currentPlan: string;
  monthlyLimit: number;
  bonusInspections: number;
  usedThisMonth: number;
  contactName: string;
  contactEmail: string;
  message?: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping upgrade request email");
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: "isaac@notibuy.com",
    replyTo: opts.contactEmail,
    subject: `Upgrade Request: ${opts.orgName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="margin: 0 0 8px;">Plan Upgrade Request</h2>
        <p style="color: #555; margin: 0 0 24px;"><strong>${opts.orgName}</strong> is requesting a plan upgrade.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 4px; font-size: 14px; color: #777;">Current Plan</p>
          <p style="margin: 0 0 16px; font-weight: 600;">${opts.currentPlan}</p>
          <p style="margin: 0 0 4px; font-size: 14px; color: #777;">Usage This Month</p>
          <p style="margin: 0 0 16px; font-weight: 600;">${opts.usedThisMonth} / ${opts.monthlyLimit} (${opts.bonusInspections} bonus remaining)</p>
          <p style="margin: 0 0 4px; font-size: 14px; color: #777;">Contact</p>
          <p style="margin: 0; font-weight: 600;">${opts.contactName} &lt;${opts.contactEmail}&gt;</p>
        </div>
        ${opts.message ? `<p style="color: #555; margin: 0 0 16px;"><strong>Message:</strong> ${opts.message}</p>` : ""}
        <p style="color: #999; font-size: 12px; margin: 24px 0 0;">Org ID: ${opts.orgId}</p>
      </div>
    `,
  });
}
