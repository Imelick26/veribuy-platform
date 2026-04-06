import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "border-l-4 border-l-red-500 border-border-default bg-surface-raised";
    case "MAJOR": return "border-l-4 border-l-red-500 border-border-default bg-surface-raised";
    case "MODERATE": return "border-border-default bg-surface-raised";
    case "MINOR": return "border-border-default bg-surface-raised";
    default: return "border-border-default bg-surface-raised";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "COMPLETED": return "text-green-700 bg-[#dcfce7]";
    case "CANCELLED": return "text-red-700 bg-[#fde8e8]";
    case "CREATED": return "text-text-secondary bg-surface-overlay";
    default: return "text-brand-700 bg-[#fce8f3]";
  }
}

/** Maps deal recommendation to badge display info */
export function getDealRatingBadge(recommendation: string | null | undefined): {
  label: string;
  variant: "deal-strong-buy" | "deal-fair-buy" | "deal-overpaying" | "deal-pass" | "default";
} {
  switch (recommendation) {
    case "STRONG_BUY": return { label: "STRONG BUY", variant: "deal-strong-buy" };
    case "FAIR_BUY": return { label: "FAIR BUY", variant: "deal-fair-buy" };
    case "OVERPAYING": return { label: "OVERPAYING", variant: "deal-overpaying" };
    case "PASS": return { label: "PASS", variant: "deal-pass" };
    default: return { label: "PENDING", variant: "default" };
  }
}

const STEP_MAP: Record<string, { step: number; label: string }> = {
  CREATED: { step: 1, label: "Media Capture" },
  VIN_DECODED: { step: 2, label: "VIN Confirm" },
  RISK_REVIEWED: { step: 3, label: "Condition Scan" },
  MEDIA_CAPTURE: { step: 4, label: "Risk Check" },
  AI_ANALYZED: { step: 5, label: "Vehicle History" },
  MARKET_PRICED: { step: 6, label: "Market Analysis" },
  REVIEWED: { step: 7, label: "Report" },
};

/** Maps inspection status to step progress for dashboard display */
export function getStepProgress(status: string): { step: number; total: number; label: string } {
  const match = STEP_MAP[status];
  if (match) return { ...match, total: 7 };
  return { step: 0, total: 7, label: status.replace(/_/g, " ") };
}

/** Simple relative time formatter */
export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}
