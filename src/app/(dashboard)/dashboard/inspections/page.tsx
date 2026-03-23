"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Plus, ClipboardCheck, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, statusColor } from "@/lib/utils";

export default function InspectionsPage() {
  const { data, isLoading } = trpc.inspection.list.useQuery({ limit: 50 });
  const inspections = data?.inspections || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Inspections</h1>
          <p className="text-text-secondary mt-1">Manage and track vehicle inspections</p>
        </div>
        <Link href="/dashboard/inspections/new" className="self-start sm:self-auto flex-shrink-0">
          <Button>
            <Plus className="h-4 w-4" />
            New Inspection
          </Button>
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner-gradient" />
          </div>
        ) : inspections.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardCheck className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-text-primary mb-1">No inspections yet</h3>
            <p className="text-text-secondary mb-6">Start your first vehicle inspection</p>
            <Link href="/dashboard/inspections/new">
              <Button>
                <Plus className="h-4 w-4" /> Start Inspection
              </Button>
            </Link>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border-default">
            {inspections.map((insp) => (
              <Link key={insp.id} href={`/dashboard/inspections/${insp.id}`} className="block px-4 py-3 hover:bg-surface-hover transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-text-primary text-sm">
                    {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                  </p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(insp.status)}`}>
                    {insp.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="font-mono">{insp.number}</span>
                  <span>{formatDate(insp.createdAt)}</span>
                  {insp.overallScore != null && (
                    <span className={`font-semibold ${insp.overallScore >= 70 ? "text-green-700" : insp.overallScore >= 50 ? "text-text-secondary" : "text-red-700"}`}>
                      {insp.overallScore}/100
                    </span>
                  )}
                  {insp._count.media > 0 && (
                    <span className="inline-flex items-center gap-1 text-brand-600">
                      <Camera className="h-3 w-3" />
                      {insp._count.media}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Vehicle</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Number</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Inspector</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Status</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Score</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Photos</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/inspections/${insp.id}`} className="block">
                      <p className="font-medium text-text-primary">
                        {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                      </p>
                      <p className="text-xs text-text-secondary font-mono">{insp.vehicle.vin}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary font-mono">{insp.number}</td>
                  <td className="px-5 py-3 text-sm text-text-secondary">{insp.inspector.name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(insp.status)}`}>
                      {insp.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {insp.overallScore != null ? (
                      <span className={`font-semibold ${
                        insp.overallScore >= 70 ? "text-green-700" :
                        insp.overallScore >= 50 ? "text-text-secondary" : "text-red-700"
                      }`}>
                        {insp.overallScore}/100
                      </span>
                    ) : (
                      <span className="text-text-tertiary">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {insp._count.media > 0 ? (
                      <Link
                        href={`/dashboard/inspections/${insp.id}#photos`}
                        className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span className="font-medium">{insp._count.media}</span>
                      </Link>
                    ) : (
                      <span className="text-text-tertiary">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">{formatDate(insp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
