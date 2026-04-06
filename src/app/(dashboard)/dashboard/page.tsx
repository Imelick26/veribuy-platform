"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Overline } from "@/components/ui/Overline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { formatCurrency, getDealRatingBadge, getStepProgress, relativeTime, cn } from "@/lib/utils";

export default function DashboardPage() {
  const { data: inspections } = trpc.inspection.list.useQuery({ limit: 30 });
  const { data: usage } = trpc.inspection.usageStats.useQuery();
  const atLimit = usage ? usage.used >= (usage.limit + usage.bonusInspections) : false;
  const [showLimitModal, setShowLimitModal] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  const allInspections = inspections?.inspections || [];

  // Categorize inspections for the operations feed
  const needsDecision = allInspections.filter(
    (i) => i.status === "COMPLETED" && i.marketAnalysis && !i.purchaseOutcome
  );
  const inProgress = allInspections.filter(
    (i) => !["COMPLETED", "CANCELLED"].includes(i.status)
  );
  // Awaiting outcome: completed, no market analysis OR completed with no outcome and older than 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const awaitingOutcome = allInspections.filter(
    (i) => i.status === "COMPLETED" && !i.purchaseOutcome && !i.marketAnalysis
      && i.completedAt && new Date(i.completedAt).getTime() < threeDaysAgo
  );

  const recordOutcome = trpc.inspection.recordOutcome.useMutation({
    onSuccess: () => {
      utils.inspection.list.invalidate();
    },
  });

  function handleNewInspection(e: React.MouseEvent) {
    e.preventDefault();
    if (atLimit) {
      setShowLimitModal(true);
    } else {
      router.push("/dashboard/inspections/new");
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Dashboard</h1>
        <Button size="md" onClick={handleNewInspection}>
          <Plus className="h-4 w-4" /> New Inspection
        </Button>
      </div>

      {/* ═══ NEEDS YOUR DECISION ═══ */}
      {needsDecision.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <Overline>Needs Your Decision</Overline>
            <span className="text-xs text-text-tertiary">{needsDecision.length} vehicle{needsDecision.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {needsDecision.map((insp) => {
              const ma = insp.marketAnalysis as {
                recommendation?: string;
                estRetailPrice?: number;
                estReconCost?: number;
                adjustedPrice?: number;
              } | null;
              const rating = getDealRatingBadge(ma?.recommendation);
              const estRetail = ma?.estRetailPrice || ma?.adjustedPrice || 0;
              const reconCost = ma?.estReconCost || 0;
              const vehicleName = insp.vehicle
                ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                : "Vehicle pending";

              return (
                <Link
                  key={insp.id}
                  href={`/dashboard/vehicles/${insp.vehicle?.id || insp.id}`}
                  className="block"
                >
                  <Card hoverable className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant={rating.variant} className="text-[10px]">{rating.label}</Badge>
                          <span className="text-sm font-semibold text-text-primary truncate">{vehicleName}</span>
                          <span className="text-xs text-text-tertiary shrink-0">{insp.number}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                          {estRetail > 0 && (
                            <span className="font-semibold text-money-neutral">{formatCurrency(estRetail)} retail</span>
                          )}
                          {insp.overallScore != null && (
                            <span>Score {insp.overallScore}/100</span>
                          )}
                          {insp._count.findings > 0 && (
                            <span>{insp._count.findings} finding{insp._count.findings !== 1 ? "s" : ""}</span>
                          )}
                          {reconCost > 0 && (
                            <span className="text-money-negative">{formatCurrency(reconCost)} recon</span>
                          )}
                        </div>
                        {insp.completedAt && (
                          <p className="text-[11px] text-text-tertiary mt-1.5">
                            Inspected {relativeTime(insp.completedAt)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0 mt-1" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ IN PROGRESS ═══ */}
      {inProgress.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <Overline>In Progress</Overline>
            <span className="text-xs text-text-tertiary">{inProgress.length} vehicle{inProgress.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {inProgress.map((insp) => {
              const progress = getStepProgress(insp.status);
              const pct = Math.round((progress.step / progress.total) * 100);
              const vehicleName = insp.vehicle
                ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                : "Vehicle pending";

              return (
                <Link
                  key={insp.id}
                  href={`/dashboard/inspections/${insp.id}`}
                  className="block"
                >
                  <Card hoverable className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate">{vehicleName}</span>
                        <span className="text-xs text-text-tertiary shrink-0">
                          Step {progress.step}/{progress.total}: {progress.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-text-primary">{pct}%</span>
                        <ArrowRight className="h-3.5 w-3.5 text-text-tertiary" />
                      </div>
                    </div>
                    <Progress value={pct} color="brand" size="sm" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ AWAITING OUTCOME ═══ */}
      {awaitingOutcome.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <Overline>Awaiting Outcome</Overline>
            <span className="text-xs text-text-tertiary">{awaitingOutcome.length} vehicle{awaitingOutcome.length !== 1 ? "s" : ""}</span>
          </div>
          <Card className="p-0 divide-y divide-border-default">
            {awaitingOutcome.slice(0, 10).map((insp) => (
              <div key={insp.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {insp.vehicle ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}` : "Vehicle"}
                  </span>
                  {insp.completedAt && (
                    <span className="text-xs text-text-tertiary shrink-0">
                      Inspected {relativeTime(insp.completedAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => recordOutcome.mutate({ inspectionId: insp.id, outcome: "PURCHASED" })}
                    className="px-3 py-1 rounded-md text-xs font-medium border border-border-strong text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    Bought
                  </button>
                  <button
                    onClick={() => recordOutcome.mutate({ inspectionId: insp.id, outcome: "PASSED" })}
                    className="px-3 py-1 rounded-md text-xs font-medium border border-border-strong text-text-secondary hover:bg-surface-hover transition-colors"
                  >
                    Passed
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* ═══ USAGE ═══ */}
      {usage && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <Overline>Usage</Overline>
            <span className="text-xs text-text-secondary">
              {usage.used} / {usage.limit}{usage.bonusInspections > 0 ? ` (+${usage.bonusInspections})` : ""} this month
            </span>
          </div>
          <Progress
            value={Math.min(100, (usage.used / (usage.limit + usage.bonusInspections)) * 100)}
            color="brand"
            size="md"
          />
          {(usage as { resetDate?: string }).resetDate && (
            <p className="text-[11px] text-text-tertiary mt-1">Resets {new Date((usage as { resetDate?: string }).resetDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          )}
        </section>
      )}

      {/* Empty state — no inspections at all */}
      {allInspections.length === 0 && !inspections && (
        <div className="text-center py-16">
          <p className="text-sm text-text-secondary mb-4">No inspections yet. Start your first one.</p>
          <Button onClick={handleNewInspection}>
            <Plus className="h-4 w-4" /> Start First Inspection
          </Button>
        </div>
      )}

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
