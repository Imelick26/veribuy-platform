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

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping password reset email");
    console.log(`Password reset URL: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your VeriBuy password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="margin: 0 0 8px;">Reset your password</h2>
        <p style="color: #555; margin: 0 0 24px;">Hi ${name}, we received a request to reset your VeriBuy password. Click the button below to set a new one.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">Reset Password</a>
        <p style="color: #999; font-size: 13px; margin: 24px 0 0;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #999; font-size: 12px; margin: 24px 0 0;">&mdash; VeriBuy Vehicle Inspection Intelligence</p>
      </div>
    `,
  });
}

export async function sendOutcomeEmail(opts: {
  to: string;
  inspectorName: string;
  vehicleDesc: string;
  inspectionNumber: string;
  purchasedUrl: string;
  passedUrl: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping outcome email");
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Did you buy the ${opts.vehicleDesc}?`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="margin: 0 0 8px;">Quick follow-up</h2>
        <p style="color: #555; margin: 0 0 24px;">Hi ${opts.inspectorName}, you inspected a <strong>${opts.vehicleDesc}</strong> (${opts.inspectionNumber}) recently. Did you end up purchasing it?</p>
        <p style="color: #777; font-size: 13px; margin: 0 0 20px;">Your feedback helps us improve pricing accuracy for everyone.</p>
        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <a href="${opts.purchasedUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Yes, I bought it</a>
          <a href="${opts.passedUrl}" style="display: inline-block; background: #f5f5f5; color: #555; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; border: 1px solid #ddd;">No, I passed</a>
        </div>
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
