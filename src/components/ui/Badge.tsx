import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gradient";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-gray-100 text-gray-700": variant === "default",
          "bg-green-50 text-green-700 ring-1 ring-green-600/10": variant === "success",
          "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/10": variant === "warning",
          "bg-red-50 text-red-700 ring-1 ring-red-600/10": variant === "danger",
          "bg-brand-50 text-brand-700 ring-1 ring-brand-500/10": variant === "info",
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
