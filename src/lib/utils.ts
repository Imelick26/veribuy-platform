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
    case "CRITICAL": return "text-red-600 bg-red-50 border-red-200";
    case "MAJOR": return "text-orange-600 bg-orange-50 border-orange-200";
    case "MODERATE": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "MINOR": return "text-blue-600 bg-blue-50 border-blue-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "COMPLETED": return "text-green-700 bg-green-50";
    case "CANCELLED": return "text-red-700 bg-red-50";
    case "CREATED": return "text-gray-700 bg-gray-50";
    default: return "text-blue-700 bg-blue-50";
  }
}
