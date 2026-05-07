import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-10 px-3 rounded border bg-cream-50 text-ink placeholder:text-ink-subtle",
          "border-cream-300 focus:border-sage-500 focus:bg-white",
          "focus:outline-none focus:ring-2 focus:ring-sage-500/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          invalid && "border-terracotta-500 focus:border-terracotta-500 focus:ring-terracotta-500/20",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
