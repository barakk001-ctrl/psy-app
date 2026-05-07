import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full px-3 py-2 rounded border bg-cream-50 text-ink placeholder:text-ink-subtle",
      "border-cream-300 focus:border-sage-500 focus:bg-white",
      "focus:outline-none focus:ring-2 focus:ring-sage-500/20",
      "min-h-[88px] resize-y",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
