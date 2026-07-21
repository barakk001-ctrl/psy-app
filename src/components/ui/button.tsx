import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-sage-500 to-sage-600 text-cream-50 shadow-glow hover:from-sage-600 hover:to-sage-700 active:from-sage-700 active:to-sage-700 disabled:from-sage-300 disabled:to-sage-300 disabled:shadow-none",
  secondary:
    "bg-white/70 backdrop-blur-sm text-ink border border-cream-300 shadow-soft hover:bg-white hover:border-cream-400 disabled:opacity-60",
  ghost: "bg-transparent text-ink-soft hover:bg-cream-200/70 disabled:opacity-60",
  danger:
    "bg-gradient-to-b from-terracotta-500 to-terracotta-600 text-cream-50 hover:from-terracotta-600 hover:to-terracotta-600 disabled:opacity-60",
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
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium",
          "transition-all duration-200 active:scale-[0.97]",
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
