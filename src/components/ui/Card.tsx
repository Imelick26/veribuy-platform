import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  accent?: boolean;
}

export function Card({ className, accent, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-all duration-200",
        accent && "card-accent-top",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold text-text-primary", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-text-secondary mt-1", className)} {...props}>
      {children}
    </p>
  );
}
