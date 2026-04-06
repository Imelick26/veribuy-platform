import { cn } from "@/lib/utils";

interface OverlineProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function Overline({ className, children, ...props }: OverlineProps) {
  return (
    <span
      className={cn(
        "text-[11px] uppercase tracking-widest font-semibold text-text-secondary",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
