import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gradient";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-surface-overlay text-text-secondary": variant === "default",
          "bg-[#0a2e1a] text-green-400 ring-1 ring-green-500/20": variant === "success",
          "bg-surface-overlay text-text-secondary ring-1 ring-border-strong": variant === "warning",
          "bg-[#2e0a0a] text-red-400 ring-1 ring-red-500/20": variant === "danger",
          "bg-[#1a0a2e] text-brand-300 ring-1 ring-brand-500/20": variant === "info",
          "bg-brand-gradient text-white shadow-sm": variant === "gradient",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
