"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ClipboardCheck,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Gauge,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export default function DashboardPage() {
  const { data: inspections } = trpc.inspection.list.useQuery({ limit: 5 });
  const { data: reports } = trpc.report.list.useQuery({ limit: 5 });
  const { data: usage } = trpc.inspection.usageStats.useQuery();
  const atLimit = usage ? usage.used >= (usage.limit + usage.bonusInspections) : false;
  const [showLimitModal, setShowLimitModal] = useState(false);
  const router = useRouter();
  const recentInspections = inspections?.inspections || [];
  const recentReports = reports?.reports || [];
  const { data: pendingOutcomes } = trpc.inspection.pendingOutcomes.useQuery();

  function handleNewInspection(e: React.MouseEvent) {
    e.preventDefault();
    if (atLimit) {
      setShowLimitModal(true);
    } else {
      router.push("/dashboard/inspections/new");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of your inspection activity</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:border-border-strong transition-colors" onClick={() => router.push("/dashboard/inspections")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <ClipboardCheck className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-sm text-text-secondary">Active Inspections</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {recentInspections.filter((i) => i.status !== "COMPLETED" && i.status !== "CANCELLED").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-border-strong transition-colors" onClick={() => router.push("/dashboard/vehicles")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-sm text-text-secondary">Completed</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {recentInspections.filter((i) => i.status === "COMPLETED").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-border-strong transition-colors" onClick={() => router.push("/dashboard/settings")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-sm text-text-secondary">Monthly Usage</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {usage
                  ? `${usage.used} / ${usage.limit}${usage.bonusInspections > 0 ? ` (+${usage.bonusInspections})` : ""}`
                  : "\u2014"}
              </p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-border-strong transition-colors" onClick={() => router.push("/dashboard/reports")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                <p className="text-sm text-text-secondary">Reports</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">{recentReports.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending outcomes nudge */}
      {pendingOutcomes && pendingOutcomes.count > 0 && (
        <Card className="border-l-4 border-l-yellow-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-yellow-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {pendingOutcomes.count} inspection{pendingOutcomes.count !== 1 ? "s" : ""} awaiting outcome
                </p>
                <p className="text-xs text-text-secondary">
                  Did you buy these vehicles? Your feedback improves pricing accuracy.
                </p>
              </div>
            </div>
            <Link href="/dashboard/inspections" className="text-xs text-text-primary font-semibold hover:underline">
              Review
            </Link>
          </div>
        </Card>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Inspections */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Inspections</CardTitle>
              <Link href="/dashboard/inspections">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          {recentInspections.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-secondary mb-3">No inspections yet</p>
              <Button size="sm" onClick={handleNewInspection}>
                <Plus className="h-3.5 w-3.5" /> Start First Inspection
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {recentInspections.map((insp) => (
                <Link
                  key={insp.id}
                  href={`/dashboard/inspections/${insp.id}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <div>
                    <p className="font-medium text-text-primary text-sm">
                      {insp.vehicle ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}` : "Vehicle pending"}
                    </p>
                    <p className="text-xs text-text-secondary">{insp.number}</p>
                  </div>
                  <Badge
                    variant={
                      insp.status === "COMPLETED" ? "success" :
                      insp.status === "CANCELLED" ? "danger" : "info"
                    }
                  >
                    {insp.status.replace(/_/g, " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <div className="space-y-1">
            <button
              onClick={handleNewInspection}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors w-full text-left cursor-pointer"
            >
              <Plus className="h-4 w-4 text-text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">New Inspection</p>
                <p className="text-xs text-text-secondary">Start a vehicle inspection by entering a VIN</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
            </button>
            <Link
              href="/dashboard/reports"
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <FileText className="h-4 w-4 text-text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">View Reports</p>
                <p className="text-xs text-text-secondary">Access generated inspection reports</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
            </Link>
            <Link
              href="/dashboard/vehicles"
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <TrendingUp className="h-4 w-4 text-text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">Vehicle Database</p>
                <p className="text-xs text-text-secondary">Browse all inspected vehicles</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
            </Link>
          </div>
        </Card>
      </div>

      {usage && (
        <UpgradeModal
          open={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          usage={usage}
        />
      )}
    </div>
  );
}
