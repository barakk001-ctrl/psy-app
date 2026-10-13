import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_FACTS, PLAN_FEATURES, PLAN_OPTIONS, type PlanOption } from "@/lib/plans";

/**
 * The two plans side by side, what every plan includes, and the short rules.
 * Shared by the public /pricing page and the in-app /subscription page;
 * `renderAction` puts each plan's button (buy / request / register) under it.
 */
export function PlanCards({
  renderAction,
  currentPlan,
}: {
  renderAction?: (plan: PlanOption) => React.ReactNode;
  /** the plan the account is on now, marked "המסלול שלך" */
  currentPlan?: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        {PLAN_OPTIONS.map((p) => (
          <section
            key={p.id}
            aria-labelledby={`plan-${p.id}`}
            className={cn(
              "relative rounded-2xl border px-5 py-5 flex flex-col",
              p.highlight
                ? "border-sage-300 bg-sage-50/70 shadow-soft"
                : "border-cream-300 bg-white/70",
            )}
          >
            {p.highlight && (
              <span className="absolute -top-3 start-5 rounded-full bg-sage-600 px-3 py-0.5 text-xs font-medium text-cream-50">
                הכי משתלם
              </span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h2 id={`plan-${p.id}`} className="font-display text-xl text-ink">
                {p.title}
              </h2>
              {currentPlan === p.id && (
                <span className="rounded-full border border-sage-300 bg-white px-2.5 py-0.5 text-xs text-sage-700">
                  המסלול שלך
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-4xl text-ink">₪{p.price}</span>
              <span className="text-sm text-ink-muted">{p.per}</span>
              <span className="text-sm text-ink-subtle line-through">₪{p.regularPrice}</span>
            </div>
            <p className="text-xs font-medium text-sage-700 mt-1">מחיר היכרות</p>
            <p className="text-sm text-ink-soft mt-3 leading-relaxed flex-1">{p.note}</p>
            {renderAction && <div className="mt-4">{renderAction(p)}</div>}
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-cream-300 bg-white/60 px-5 py-4">
        <h3 className="font-display text-lg text-ink">כל המסלולים כוללים הכול</h3>
        <p className="text-sm text-ink-muted mt-0.5">
          ההבדל בין המסלולים הוא רק בתדירות התשלום.
        </p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {PLAN_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-sage-600" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="space-y-1.5 text-sm text-ink-soft list-disc ps-5">
        {PLAN_FACTS.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
