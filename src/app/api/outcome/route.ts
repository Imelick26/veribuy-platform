/**
 * Token-verified outcome endpoint for email button clicks.
 *
 * "No, I passed" button links here directly → saves outcome → redirects to thank-you.
 * "Yes, I bought it" button links to /outcome/[token] page for price input.
 */

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/server/db";

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret-do-not-use-in-prod");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { inspectionId, action } = payload as { inspectionId: string; action: string };

    if (action !== "PASSED" && action !== "PURCHASED") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if outcome already recorded
    const inspection = await db.inspection.findUnique({
      where: { id: inspectionId },
      select: { purchaseOutcome: true },
    });

    if (inspection?.purchaseOutcome) {
      return NextResponse.redirect(`${APP_URL}/outcome/already-recorded`);
    }

    // Record the outcome
    await db.inspection.update({
      where: { id: inspectionId },
      data: {
        purchaseOutcome: action,
        outcomeRecordedAt: new Date(),
      },
    });

    return NextResponse.redirect(`${APP_URL}/outcome/thank-you`);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}

/**
 * POST handler for the purchase price submission from /outcome/[token] page.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, purchasePrice } = body as { token: string; purchasePrice?: number };

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { inspectionId } = payload as { inspectionId: string };

    await db.inspection.update({
      where: { id: inspectionId },
      data: {
        purchaseOutcome: "PURCHASED",
        purchasePrice: purchasePrice ? Math.round(purchasePrice * 100) : null, // Convert dollars to cents
        outcomeRecordedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}
