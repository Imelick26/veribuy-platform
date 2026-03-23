"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

export default function ReportsPage() {
  const router = useRouter();
  const { data, isLoading } = trpc.report.list.useQuery({ limit: 50 });
  const reports = data?.reports || [];

  const utils = trpc.useUtils();

  async function handleDownloadPDF(reportId: string, fallbackUrl?: string | null) {
    try {
      const { url } = await utils.report.downloadPDF.fetch({ id: reportId });
      window.open(url, "_blank");
    } catch {
      if (fallbackUrl) window.open(fallbackUrl, "_blank");
    }
  }

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
            <FileText className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-text-primary mb-1">No reports yet</h3>
            <p className="text-text-secondary">Reports are generated when inspections are completed</p>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border-default">
            {reports.map((r) => (
              <div key={r.id} className="px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/reports/${r.id}`)}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-text-primary text-sm">
                    {r.inspection.vehicle.year} {r.inspection.vehicle.make} {r.inspection.vehicle.model}
                  </p>
                  <Badge variant="info">{r.inspection._count.findings} findings</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="font-mono">{r.number}</span>
                  <span>{formatDate(r.generatedAt)}</span>
                  <span>{r.viewCount} views</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Report</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Vehicle</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Findings</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Views</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Generated</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/reports/${r.id}`)}>
                  <td className="px-5 py-3 font-mono text-sm text-text-primary">{r.number}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-text-primary">
                      {r.inspection.vehicle.year} {r.inspection.vehicle.make} {r.inspection.vehicle.model}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="info">{r.inspection._count.findings}</Badge>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">{r.viewCount}</td>
                  <td className="px-5 py-3 text-sm text-text-secondary">{formatDate(r.generatedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {r.pdfUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDownloadPDF(r.id, r.pdfUrl); }}
                        >
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
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
