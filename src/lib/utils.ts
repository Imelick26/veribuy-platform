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
    case "CRITICAL": return "text-red-400 bg-[#2e0a0a] border-red-900/50";
    case "MAJOR": return "text-red-400 bg-[#2e0a0a] border-red-900/50";
    case "MODERATE": return "text-text-secondary bg-surface-overlay border-border-strong";
    case "MINOR": return "text-brand-300 bg-[#1a0a2e] border-brand-800/50";
    default: return "text-text-secondary bg-surface-overlay border-border-default";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "COMPLETED": return "text-green-400 bg-[#0a2e1a]";
    case "CANCELLED": return "text-red-400 bg-[#2e0a0a]";
    case "CREATED": return "text-text-secondary bg-surface-overlay";
    default: return "text-brand-300 bg-[#1a0a2e]";
  }
}
