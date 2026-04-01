import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gradient" | "critical" | "major";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-surface-overlay text-text-secondary": variant === "default",
          "text-green-700 ring-1 ring-green-300 bg-green-50": variant === "success",
          "text-amber-700 ring-1 ring-amber-300 bg-amber-50": variant === "warning",
          "text-red-700 ring-1 ring-red-300 bg-red-50": variant === "danger",
          "text-text-secondary ring-1 ring-border-strong": variant === "info",
          "bg-brand-gradient text-white shadow-brand-glow": variant === "gradient",
          "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-sm": variant === "critical",
          "bg-gradient-to-r from-orange-500 to-orange-700 text-white shadow-sm": variant === "major",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
