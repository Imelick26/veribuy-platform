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
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Reports</h1>
        <p className="text-text-secondary mt-1">Generated inspection reports</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner-gradient" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-[#1a0a2e] flex items-center justify-center">
              <FileText className="h-7 w-7 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">No reports yet</h3>
            <p className="text-text-secondary">Reports are generated when inspections are completed</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Report</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Findings</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Views</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Generated</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-brand-gradient-subtle transition-all duration-200">
                  <td className="px-6 py-4 font-mono text-sm text-text-primary">{r.number}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-text-primary">
                      {r.inspection.vehicle.year} {r.inspection.vehicle.make} {r.inspection.vehicle.model}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="info">{r.inspection._count.findings}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">{r.viewCount}</td>
                  <td className="px-6 py-4 text-sm text-text-secondary">{formatDate(r.generatedAt)}</td>
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
