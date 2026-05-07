import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
      </header>
      <Card>
        <CardContent className="py-16 text-center max-w-md mx-auto">
          <Icon className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
          <h3 className="font-display text-xl text-ink">בקרוב</h3>
          <p className="text-ink-muted text-sm mt-2 leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
