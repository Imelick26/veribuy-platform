"use client";

import { X, FileText, Download, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface ReportModalProps {
  reportId: string;
  reportNumber: string;
  pdfUrl?: string | null;
  shareToken?: string | null;
  onClose: () => void;
}

export function ReportModal({ reportId, reportNumber, pdfUrl, shareToken, onClose }: ReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const utils = trpc.useUtils();

  const reportPageUrl = `/dashboard/reports/${reportId}`;
  const shareUrl = shareToken ? `${window.location.origin}/reports/shared/${shareToken}` : null;

  function handleCopyLink() {
    const url = shareUrl || `${window.location.origin}${reportPageUrl}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const { url } = await utils.report.downloadPDF.fetch({ id: reportId });
      window.open(url, "_blank");
    } catch {
      if (pdfUrl) window.open(pdfUrl, "_blank");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-8 md:inset-12 lg:inset-16 bg-surface-overlay rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-surface-raised">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-brand-600" />
            <div>
              <h3 className="font-semibold text-text-primary">Inspection Report</h3>
              <p className="text-xs text-text-tertiary">{reportNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              title="Copy share link"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            {pdfUrl && (
              <Button
                variant="secondary"
                size="sm"
                disabled={pdfLoading}
                onClick={handleDownloadPDF}
              >
                <Download className="h-4 w-4" /> {pdfLoading ? "Loading…" : "PDF"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(reportPageUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors"
            >
              <X className="h-5 w-5 text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Embedded report page */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={reportPageUrl}
            className="w-full h-full border-0"
            title="Inspection Report"
          />
        </div>
      </div>
    </>
  );
}
