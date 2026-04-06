import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Show a gradient accent bar on the left edge */
  accent?: boolean;
  /** Enable hover elevation effect */
  hoverable?: boolean;
  /** Hero variant — thick border, extra padding. One per page max. */
  hero?: boolean;
}

export function Card({ className, children, accent, hoverable, hero, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-surface-raised p-6 transition-all",
        hoverable && "hover:shadow-md",
        accent && "card-accent-left pl-6",
        hero && "border-2 border-text-primary p-8",
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
    <div className={cn("mb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-bold tracking-tight text-text-primary", className)} {...props}>
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
