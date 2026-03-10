"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          {
            "bg-brand-gradient text-white shadow-brand-glow hover:shadow-brand-glow-lg hover:brightness-110 active:brightness-95 focus:ring-brand-400":
              variant === "primary",
            "bg-white text-gray-700 border border-gray-200 hover:border-brand-300 hover:text-brand-700 hover:shadow-sm focus:ring-brand-400":
              variant === "secondary",
            "text-gray-600 hover:bg-brand-50 hover:text-brand-700 focus:ring-brand-400":
              variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md focus:ring-red-500":
              variant === "danger",
          },
          {
            "text-sm px-3.5 py-1.5": size === "sm",
            "text-sm px-5 py-2.5": size === "md",
            "text-base px-7 py-3": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
