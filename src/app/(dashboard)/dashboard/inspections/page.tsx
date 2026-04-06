"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Overline";
import { Progress } from "@/components/ui/Progress";
import Link from "next/link";
import { Plus, ClipboardCheck, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatCurrency, getStepProgress, relativeTime, cn } from "@/lib/utils";

export default function InspectionsPage() {
  const { data, isLoading } = trpc.inspection.list.useQuery({ limit: 50 });
  const inspections = data?.inspections || [];

  // Separate completed from in-progress
  const completed = inspections.filter((i) => i.status === "COMPLETED");
  const inProgress = inspections.filter((i) => !["COMPLETED", "CANCELLED"].includes(i.status));
  const cancelled = inspections.filter((i) => i.status === "CANCELLED");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Inspections</h1>
        <Link href="/dashboard/inspections/new">
          <Button>
            <Plus className="h-4 w-4" /> New Inspection
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner-gradient" />
        </div>
      ) : inspections.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardCheck className="h-6 w-6 text-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-text-secondary mb-4">No inspections yet</p>
          <Link href="/dashboard/inspections/new">
            <Button>
              <Plus className="h-4 w-4" /> Start Inspection
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <Overline>In Progress ({inProgress.length})</Overline>
              </div>
              <div className="space-y-2">
                {inProgress.map((insp) => {
                  const progress = getStepProgress(insp.status);
                  const pct = Math.round((progress.step / progress.total) * 100);
                  const vehicleName = insp.vehicle
                    ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                    : "Vehicle pending";

                  return (
                    <Link key={insp.id} href={`/dashboard/inspections/${insp.id}`} className="block">
                      <Card hoverable className="p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-text-primary truncate">{vehicleName}</span>
                            <span className="text-xs text-text-tertiary font-mono shrink-0">{insp.number}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-secondary">
                              Step {progress.step}/{progress.total}: {progress.label}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
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

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <Overline>Completed ({completed.length})</Overline>
              </div>
              <Card className="p-0 overflow-hidden">
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Vehicle</th>
                      <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Retail</th>
                      <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Score</th>
                      <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Recon</th>
                      <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Outcome</th>
                      <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {completed.map((insp) => {
                      const ma = insp.marketAnalysis as {
                        estRetailPrice?: number;
                        estReconCost?: number;
                      } | null;
                      const vehicleName = insp.vehicle
                        ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                        : "Vehicle pending";

                      return (
                        <tr key={insp.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/inspections/${insp.id}`}>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-text-primary">{vehicleName}</p>
                            <p className="text-xs text-text-tertiary font-mono">{insp.number}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {ma?.estRetailPrice ? (
                              <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(ma.estRetailPrice)}</span>
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {insp.overallScore != null ? (
                              <span className={cn(
                                "text-sm font-bold tabular-nums",
                                insp.overallScore >= 70 ? "text-green-600" : insp.overallScore >= 60 ? "text-caution-500" : "text-red-600"
                              )}>
                                {insp.overallScore}
                              </span>
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {ma?.estReconCost && ma.estReconCost > 0 ? (
                              <span className="text-sm font-semibold text-money-negative tabular-nums">{formatCurrency(ma.estReconCost)}</span>
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {insp.purchaseOutcome === "PURCHASED" ? (
                              <Badge variant="success" className="text-[10px]">Bought</Badge>
                            ) : insp.purchaseOutcome === "PASSED" ? (
                              <Badge variant="default" className="text-[10px]">Passed</Badge>
                            ) : (
                              <span className="text-xs text-text-tertiary">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-text-tertiary">
                            {insp.completedAt ? relativeTime(insp.completedAt) : formatDate(insp.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile view */}
                <div className="md:hidden divide-y divide-border-default">
                  {completed.map((insp) => {
                    const ma = insp.marketAnalysis as {
                      estRetailPrice?: number;
                    } | null;
                    const vehicleName = insp.vehicle
                      ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                      : "Vehicle pending";

                    return (
                      <Link key={insp.id} href={`/dashboard/inspections/${insp.id}`} className="block px-4 py-3 hover:bg-surface-hover transition-colors">
                        <span className="text-sm font-medium text-text-primary">{vehicleName}</span>
                        <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                          <span className="font-mono">{insp.number}</span>
                          {insp.overallScore != null && (
                            <span className="font-semibold">{insp.overallScore}/100</span>
                          )}
                          {ma?.estRetailPrice ? (
                            <span>{formatCurrency(ma.estRetailPrice)}</span>
                          ) : null}
                          {insp.completedAt && (
                            <span className="text-text-tertiary">{relativeTime(insp.completedAt)}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <Overline>Cancelled ({cancelled.length})</Overline>
              </div>
              <Card className="p-0 divide-y divide-border-default">
                {cancelled.map((insp) => (
                  <Link key={insp.id} href={`/dashboard/inspections/${insp.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors">
                    <div>
                      <span className="text-sm text-text-secondary">
                        {insp.vehicle ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}` : "Vehicle pending"}
                      </span>
                      <span className="text-xs text-text-tertiary ml-2 font-mono">{insp.number}</span>
                    </div>
                    <span className="text-xs text-text-tertiary">{formatDate(insp.createdAt)}</span>
                  </Link>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
