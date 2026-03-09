"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { Plus, Search, ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, statusColor } from "@/lib/utils";

export default function InspectionsPage() {
  const { data, isLoading } = trpc.inspection.list.useQuery({ limit: 50 });
  const inspections = data?.inspections || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-1">Manage and track vehicle inspections</p>
        </div>
        <Link href="/dashboard/inspections/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Inspection
          </Button>
        </Link>
      </div>

      {/* Inspections list */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : inspections.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No inspections yet</h3>
            <p className="text-gray-500 mb-6">Start your first vehicle inspection</p>
            <Link href="/dashboard/inspections/new">
              <Button>
                <Plus className="h-4 w-4" /> Start Inspection
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Vehicle
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Number
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Inspector
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Score
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/inspections/${insp.id}`} className="block">
                      <p className="font-medium text-gray-900">
                        {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{insp.vehicle.vin}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                    {insp.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {insp.inspector.name}
                  </td>
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
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(insp.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
