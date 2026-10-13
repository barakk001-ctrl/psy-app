"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPlanAction } from "@/server/actions/subscription";

/**
 * "בקשה לרכישה" — while card payment is off, sends the operator a request for
 * this plan; the reply brings the payment details (bank transfer / Bit).
 */
export function PlanRequestButton({
  planId,
  label,
  primary,
}: {
  planId: string;
  label: string;
  primary?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (result?.ok) {
    return (
      <p className="rounded-xl border border-sage-100 bg-white px-3 py-2.5 text-sm text-sage-700 leading-relaxed">
        {result.text}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        variant={primary ? "primary" : "secondary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await requestPlanAction(planId);
              setResult(
                r.ok
                  ? {
                      ok: true,
                      text: r.emailed
                        ? "הבקשה נשלחה. נחזור אלייך עם פרטי התשלום (העברה בנקאית או ביט), והמנוי יופעל מיד כשהתשלום יתקבל."
                        : "הבקשה נשמרה אצלנו (שליחת המייל תנוסה שוב אוטומטית). נחזור אלייך עם פרטי התשלום.",
                    }
                  : { ok: false, text: r.error },
              );
            } catch {
              setResult({ ok: false, text: "אין חיבור — נסו שוב." });
            }
          })
        }
      >
        <Send className="w-4 h-4" />
        {pending ? "שולח…" : label}
      </Button>
      {result && !result.ok && <p className="text-sm text-terracotta-600">{result.text}</p>}
    </div>
  );
}
