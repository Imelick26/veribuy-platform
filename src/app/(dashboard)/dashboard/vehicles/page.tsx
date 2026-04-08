"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Car, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VehiclesPage() {
  // Self-heal: recover any inspections stuck with MARKET_ANALYSIS completed
  // but inspection.status not set to COMPLETED (e.g., client-side advanceStep failed)
  const recoverOrphans = trpc.inspection.recoverOrphanedInspections.useMutation();
  const recoveryTriggered = React.useRef(false);
  React.useEffect(() => {
    if (recoveryTriggered.current) return;
    recoveryTriggered.current = true;
    recoverOrphans.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = trpc.vehicle.list.useQuery({ limit: 50 });
  const vehicles = data?.vehicles || [];

  return (
    <div className="space-y-8">
      <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Vehicles</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner-gradient" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20">
          <Car className="h-6 w-6 text-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Vehicles are added when you start an inspection</p>
        </div>
      ) : (
        <>
          <Card className="p-0 overflow-hidden">
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Vehicle</th>
                  <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">VIN</th>
                  <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Score</th>
                  <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Status</th>
                  <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Inspections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {vehicles.map((v) => {
                  const latest = v.inspections?.[0];
                  const score = latest?.overallScore;

                  return (
                    <tr key={v.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/vehicles/${v.id}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">
                          {v.year} {v.make} {v.model} {v.trim || ""}
                        </p>
                        {v.bodyStyle && (
                          <p className="text-xs text-text-tertiary">{v.bodyStyle}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{v.vin}</td>
                      <td className="px-4 py-3 text-center">
                        {score != null ? (
                          <span className={cn(
                            "text-sm font-bold tabular-nums",
                            score >= 70 ? "text-green-600" : score >= 60 ? "text-caution-500" : "text-red-600"
                          )}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {latest ? (
                          <Badge variant={latest.status === "COMPLETED" ? "success" : "info"} className="text-[10px]">
                            {latest.status.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-text-tertiary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-text-secondary tabular-nums">{v._count.inspections}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile view */}
            <div className="md:hidden divide-y divide-border-default">
              {vehicles.map((v) => {
                const latest = v.inspections?.[0];
                const score = latest?.overallScore;

                return (
                  <Link key={v.id} href={`/dashboard/vehicles/${v.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate block">
                        {v.year} {v.make} {v.model} {v.trim || ""}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                        <span className="font-mono truncate">{v.vin}</span>
                        {score != null && (
                          <span className={cn(
                            "font-bold",
                            score >= 70 ? "text-green-600" : score >= 60 ? "text-caution-500" : "text-red-600"
                          )}>
                            {score}/100
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0 ml-2" />
                  </Link>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
