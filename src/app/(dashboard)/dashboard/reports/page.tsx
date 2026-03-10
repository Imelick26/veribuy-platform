"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Share2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ReportsPage() {
  const { data, isLoading } = trpc.report.list.useQuery({ limit: 50 });
  const reports = data?.reports || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generated inspection reports</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No reports yet</h3>
            <p className="text-gray-500">Reports are generated when inspections are completed</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Report</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Findings</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Views</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Generated</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-gray-900">{r.number}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {r.inspection.vehicle.year} {r.inspection.vehicle.make} {r.inspection.vehicle.model}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge>{r.inspection._count.findings}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.viewCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.generatedAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {r.pdfUrl && (
                        <Button variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
