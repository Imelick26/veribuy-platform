import { db } from "@/server/db";

export interface RiskItem {
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO";
  title: string;
  description: string;
  cost: { low: number; high: number }; // cents
  source: string;
  position: { x: number; y: number; z: number };
  symptoms: string[];
  category: string;
}

export interface RiskProfileData {
  id: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string | null;
  risks: RiskItem[];
  source: string;
}

export async function getRiskProfileForVehicle(
  make: string,
  model: string,
  year: number
): Promise<RiskProfileData | null> {
  const profile = await db.riskProfile.findFirst({
    where: {
      make: { equals: make, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
      yearFrom: { lte: year },
      yearTo: { gte: year },
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    make: profile.make,
    model: profile.model,
    yearFrom: profile.yearFrom,
    yearTo: profile.yearTo,
    engine: profile.engine,
    risks: profile.risks as unknown as RiskItem[],
    source: profile.source,
  };
}

/** Map risk items to 3D hotspot format for the Vehicle3D component */
export function risksToHotspots(risks: RiskItem[]) {
  return risks.map((risk, i) => ({
    id: `risk-${i}`,
    position: [risk.position.x, risk.position.y, risk.position.z] as [number, number, number],
    severity: risk.severity,
    label: risk.title,
  }));
}
