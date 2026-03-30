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
