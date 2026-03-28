/**
 * Cron endpoint: Send outcome follow-up emails for completed inspections.
 *
 * Runs daily. Finds inspections that:
 *   - Are COMPLETED
 *   - Have no purchaseOutcome recorded
 *   - Were completed 7+ days ago
 *   - Haven't had an outcome email sent yet
 *
 * Sends a simple 2-button email: "Yes, I bought it" / "No, I passed"
 *
 * Trigger: Vercel Cron, external scheduler, or manual GET request.
 * Auth: CRON_SECRET header (set in env) or skip in dev.
 */

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendOutcomeEmail } from "@/lib/email";
import { SignJWT } from "jose";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret-do-not-use-in-prod");

export async function GET(request: Request) {
  // Auth check (skip in dev)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find inspections needing outcome follow-up
  const inspections = await db.inspection.findMany({
    where: {
      status: "COMPLETED",
      purchaseOutcome: null,
      outcomeEmailSent: false,
      completedAt: { lte: sevenDaysAgo, not: null },
    },
    include: {
      vehicle: true,
      inspector: { select: { name: true, email: true } },
    },
    take: 50, // Batch limit to avoid timeout
  });

  let sent = 0;
  for (const inspection of inspections) {
    if (!inspection.vehicle || !inspection.inspector?.email) continue;

    const vehicleDesc = `${inspection.vehicle.year} ${inspection.vehicle.make} ${inspection.vehicle.model}`;

    // Generate signed tokens for email buttons (30-day expiry)
    const tokenPayload = {
      inspectionId: inspection.id,
      orgId: inspection.orgId,
    };

    const purchasedToken = await new SignJWT({ ...tokenPayload, action: "PURCHASED" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(JWT_SECRET);

    const passedToken = await new SignJWT({ ...tokenPayload, action: "PASSED" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(JWT_SECRET);

    try {
      await sendOutcomeEmail({
        to: inspection.inspector.email,
        inspectorName: inspection.inspector.name.split(" ")[0],
        vehicleDesc,
        inspectionNumber: inspection.number,
        purchasedUrl: `${APP_URL}/outcome/${purchasedToken}`,
        passedUrl: `${APP_URL}/api/outcome?token=${passedToken}`,
      });

      await db.inspection.update({
        where: { id: inspection.id },
        data: { outcomeEmailSent: true },
      });

      sent++;
    } catch (err) {
      console.error(`[OutcomeCron] Failed to send email for ${inspection.number}:`, err);
    }
  }

  return NextResponse.json({
    sent,
    total: inspections.length,
    message: `Sent ${sent} outcome follow-up emails`,
  });
}
