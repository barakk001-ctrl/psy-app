import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full px-3.5 py-2.5 rounded-xl border bg-white/60 text-ink placeholder:text-ink-subtle",
      "border-cream-300 focus:border-sage-500 focus:bg-white",
      "focus:outline-none focus:ring-4 focus:ring-sage-500/15",
      "transition-colors duration-200",
      "min-h-[88px] resize-y",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
