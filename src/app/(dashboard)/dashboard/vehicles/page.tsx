"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Car } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

export default function VehiclesPage() {
  const { data, isLoading } = trpc.vehicle.list.useQuery({ limit: 50 });
  const vehicles = data?.vehicles || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Vehicles</h1>
        <p className="text-text-secondary mt-1">All vehicles in your database</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner-gradient" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20">
            <Car className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-text-primary mb-1">No vehicles yet</h3>
            <p className="text-text-secondary">Vehicles are added when you start an inspection</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border-default">
              {vehicles.map((v) => {
                const latest = v.inspections?.[0];
                const score = latest?.overallScore;
                return (
                  <Link key={v.id} href={`/dashboard/vehicles/${v.id}`} className="block px-4 py-3 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-text-primary text-sm">
                        {v.year} {v.make} {v.model} {v.trim || ""}
                      </p>
                      <div className="flex items-center gap-2">
                        {score != null && (
                          <span className={cn(
                            "text-xs font-bold",
                            score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600"
                          )}>
                            {score}/100
                          </span>
                        )}
                        <Badge variant="info">{v._count.inspections} insp.</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span className="font-mono truncate">{v.vin}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-tertiary mt-1">
                      {v.bodyStyle && <span>{v.bodyStyle}</span>}
                      {v.drivetrain && <span>{v.drivetrain}</span>}
                      {latest && (
                        <Badge variant={latest.status === "COMPLETED" ? "success" : "info"} className="text-[9px]">
                          {latest.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Vehicle</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">VIN</th>
                    <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Score</th>
                    <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Status</th>
                    <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Inspections</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {vehicles.map((v) => {
                    const latest = v.inspections?.[0];
                    const score = latest?.overallScore;
                    return (
                      <tr key={v.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/vehicles/${v.id}`}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-text-primary">
                            {v.year} {v.make} {v.model} {v.trim || ""}
                          </p>
                          <p className="text-xs text-text-secondary">{v.bodyStyle}</p>
                        </td>
                        <td className="px-5 py-3 font-mono text-sm text-text-secondary">{v.vin}</td>
                        <td className="px-5 py-3 text-center">
                          {score != null ? (
                            <span className={cn(
                              "text-sm font-bold",
                              score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600"
                            )}>
                              {score}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {latest ? (
                            <Badge variant={latest.status === "COMPLETED" ? "success" : "info"} className="text-[10px]">
                              {latest.status.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-text-tertiary text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <Badge variant="info">{v._count.inspections}</Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-text-tertiary">{formatDate(v.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
