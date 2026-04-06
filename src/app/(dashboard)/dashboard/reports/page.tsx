"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Overline";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Share2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, relativeTime } from "@/lib/utils";

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
    <div className="space-y-8">
      <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Reports</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner-gradient" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-6 w-6 text-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Reports are generated when inspections are completed</p>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Report</th>
                <th className="text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Vehicle</th>
                <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Score</th>
                <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Findings</th>
                <th className="text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Views</th>
                <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Generated</th>
                <th className="text-right text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/reports/${r.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{r.number}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                      {r.inspection.vehicle ? `${r.inspection.vehicle.year} ${r.inspection.vehicle.make} ${r.inspection.vehicle.model}` : "Vehicle pending"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.inspection.overallScore != null ? (
                      <span className="text-sm font-bold text-text-primary tabular-nums">{r.inspection.overallScore}</span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-text-secondary tabular-nums">{r.inspection._count.findings}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-text-tertiary tabular-nums">{r.viewCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-text-tertiary">
                    {relativeTime(r.generatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {r.pdfUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDownloadPDF(r.id, r.pdfUrl); }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/reports/shared/${r.shareToken}`;
                          navigator.clipboard.writeText(url);
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile view */}
          <div className="md:hidden divide-y divide-border-default">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/reports/${r.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {r.inspection.vehicle ? `${r.inspection.vehicle.year} ${r.inspection.vehicle.make} ${r.inspection.vehicle.model}` : "Vehicle pending"}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                    <span className="font-mono">{r.number}</span>
                    <span>{relativeTime(r.generatedAt)}</span>
                    {r.inspection.overallScore != null && (
                      <span className="font-bold">{r.inspection.overallScore}/100</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
