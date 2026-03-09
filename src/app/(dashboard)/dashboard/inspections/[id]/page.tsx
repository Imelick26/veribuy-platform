"use client";

import { use } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { trpc } from "@/lib/trpc";
import { formatDate, severityColor } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  FileText,
  Camera,
  Car,
  BarChart3,
} from "lucide-react";

const STEP_LABELS: Record<string, { label: string; icon: typeof CheckCircle }> = {
  VIN_DECODE: { label: "VIN Decode", icon: Car },
  RISK_REVIEW: { label: "Risk Review", icon: AlertTriangle },
  MEDIA_CAPTURE: { label: "Media Capture", icon: Camera },
  PHYSICAL_INSPECTION: { label: "Physical Inspection", icon: CheckCircle },
  VEHICLE_HISTORY: { label: "Vehicle History", icon: Clock },
  MARKET_ANALYSIS: { label: "Market Analysis", icon: BarChart3 },
  REPORT_GENERATION: { label: "Report", icon: FileText },
};

export default function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: inspection, isLoading } = trpc.inspection.get.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Inspection not found</p>
        <Link href="/dashboard/inspections">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Inspections
          </Button>
        </Link>
      </div>
    );
  }

  const completedSteps = inspection.steps.filter((s) => s.status === "COMPLETED").length;
  const progressPct = (completedSteps / inspection.steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inspections">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {inspection.vehicle.year} {inspection.vehicle.make} {inspection.vehicle.model}
            </h1>
            <Badge
              variant={
                inspection.status === "COMPLETED" ? "success" :
                inspection.status === "CANCELLED" ? "danger" : "info"
              }
            >
              {inspection.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-gray-500 font-mono text-sm">
            {inspection.number} &middot; VIN: {inspection.vehicle.vin}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">Inspection Progress</p>
          <p className="text-sm text-gray-500">{completedSteps}/{inspection.steps.length} steps</p>
        </div>
        <Progress value={progressPct} color={progressPct === 100 ? "green" : "blue"} />

        <div className="mt-5 grid grid-cols-7 gap-2">
          {inspection.steps.map((step) => {
            const meta = STEP_LABELS[step.step] || { label: step.step, icon: Circle };
            const Icon = meta.icon;
            const isCompleted = step.status === "COMPLETED";
            const isActive = step.status === "IN_PROGRESS";

            return (
              <div key={step.id} className="text-center">
                <div
                  className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    isCompleted
                      ? "bg-green-100 text-green-600"
                      : isActive
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <p className={`text-xs ${isCompleted ? "text-green-700 font-medium" : "text-gray-500"}`}>
                  {meta.label}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Details */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {[
              ["VIN", inspection.vehicle.vin],
              ["Year", inspection.vehicle.year],
              ["Make", inspection.vehicle.make],
              ["Model", inspection.vehicle.model],
              ["Trim", inspection.vehicle.trim || "—"],
              ["Body", inspection.vehicle.bodyStyle || "—"],
              ["Drivetrain", inspection.vehicle.drivetrain || "—"],
              ["Odometer", inspection.odometer ? `${inspection.odometer.toLocaleString()} mi` : "—"],
              ["Location", inspection.location || "—"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Condition Score */}
        <Card>
          <CardHeader>
            <CardTitle>Condition Score</CardTitle>
          </CardHeader>
          {inspection.overallScore != null ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className={`text-5xl font-bold ${
                  inspection.overallScore >= 70 ? "text-green-600" :
                  inspection.overallScore >= 50 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {inspection.overallScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">out of 100</p>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Structural / Drivetrain</span>
                    <span className="font-medium">{inspection.structuralScore}/100</span>
                  </div>
                  <Progress value={inspection.structuralScore || 0} size="sm" color={
                    (inspection.structuralScore || 0) >= 70 ? "green" :
                    (inspection.structuralScore || 0) >= 50 ? "yellow" : "red"
                  } />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Cosmetic / Interior</span>
                    <span className="font-medium">{inspection.cosmeticScore}/100</span>
                  </div>
                  <Progress value={inspection.cosmeticScore || 0} size="sm" color={
                    (inspection.cosmeticScore || 0) >= 70 ? "green" :
                    (inspection.cosmeticScore || 0) >= 50 ? "yellow" : "red"
                  } />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Electronics / Software</span>
                    <span className="font-medium">{inspection.electronicsScore}/100</span>
                  </div>
                  <Progress value={inspection.electronicsScore || 0} size="sm" color={
                    (inspection.electronicsScore || 0) >= 70 ? "green" :
                    (inspection.electronicsScore || 0) >= 50 ? "yellow" : "red"
                  } />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No findings recorded yet</p>
            </div>
          )}
        </Card>

        {/* Findings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Findings</CardTitle>
              <Badge>{inspection.findings.length}</Badge>
            </div>
          </CardHeader>
          {inspection.findings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No findings yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inspection.findings.map((f) => (
                <div
                  key={f.id}
                  className={`p-3 rounded-lg border text-sm ${severityColor(f.severity)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{f.title}</span>
                    <Badge
                      variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      }
                    >
                      {f.severity}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">{f.description}</p>
                  {(f.repairCostLow || f.repairCostHigh) && (
                    <p className="text-xs mt-1 font-medium">
                      Est. repair: ${((f.repairCostLow || 0) / 100).toLocaleString()} – ${((f.repairCostHigh || 0) / 100).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
