import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full h-10 px-3 rounded border bg-cream-50 text-ink",
      "border-cream-300 focus:border-sage-500 focus:bg-white",
      "focus:outline-none focus:ring-2 focus:ring-sage-500/20",
      "appearance-none bg-no-repeat",
      // Caret on the start side (RTL → left)
      "bg-[length:12px_12px] bg-[position:left_0.75rem_center]",
      "ps-3 pe-9",
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%236B5F52' stroke-width='1.5'><path d='M3 5l3 3 3-3'/></svg>\")",
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
