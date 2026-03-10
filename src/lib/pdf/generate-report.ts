import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportDocument, type ReportData } from "./report-template";

/**
 * Renders a VeriBuy inspection report to a PDF buffer.
 * Uses @react-pdf/renderer — works in Vercel serverless (no headless browser).
 */
export async function generateReportPDF(data: ReportData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ReportDocument, { data }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
