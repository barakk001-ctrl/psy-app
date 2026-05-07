import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-sage-600 text-cream-50 hover:bg-sage-700 active:bg-sage-700 disabled:bg-sage-300",
  secondary:
    "bg-cream-100 text-ink border border-cream-300 hover:bg-cream-200 disabled:opacity-60",
  ghost: "bg-transparent text-ink-soft hover:bg-cream-200 disabled:opacity-60",
  danger:
    "bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 disabled:opacity-60",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100",
          "disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
