"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Plus, ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, statusColor } from "@/lib/utils";

export default function InspectionsPage() {
  const { data, isLoading } = trpc.inspection.list.useQuery({ limit: 50 });
  const inspections = data?.inspections || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inspections</h1>
          <p className="text-gray-500 mt-1">Manage and track vehicle inspections</p>
        </div>
        <Link href="/dashboard/inspections/new">
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
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center">
              <ClipboardCheck className="h-7 w-7 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No inspections yet</h3>
            <p className="text-gray-500 mb-6">Start your first vehicle inspection</p>
            <Link href="/dashboard/inspections/new">
              <Button>
                <Plus className="h-4 w-4" /> Start Inspection
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Number</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Inspector</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Score</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-brand-gradient-subtle transition-all duration-200">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/inspections/${insp.id}`} className="block">
                      <p className="font-medium text-gray-900">
                        {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{insp.vehicle.vin}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{insp.number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{insp.inspector.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(insp.status)}`}>
                      {insp.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {insp.overallScore != null ? (
                      <span className={`font-semibold ${
                        insp.overallScore >= 70 ? "text-green-600" :
                        insp.overallScore >= 50 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {insp.overallScore}/100
                      </span>
                    ) : (
                      <span className="text-gray-400">&mdash;</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(insp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
