import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRICE_VAT_NOTE } from "@/lib/operator";
import {
  PLAN_FACTS,
  PLAN_FEATURES,
  PLAN_OPTIONS,
  TRIAL_PLAN,
  type PlanOption,
} from "@/lib/plans";

/** The free-trial card ("מנוי היכרות"), shown first when passed. */
export type TrialCardProps = {
  /** the account is in its trial now — marked "המסלול שלך" */
  current?: boolean;
  /** a short status line on the card, e.g. the days left */
  status?: string | null;
  /** a button/link under the card (e.g. register on the public page) */
  action?: React.ReactNode;
};

/**
 * The plans side by side — the free trial first (when `trial` is passed),
 * then the paid plans — what every plan includes, and the short rules.
 * Shared by the public /pricing page and the in-app /subscription page;
 * `renderAction` puts each paid plan's button (buy / request) under it.
 */
export function PlanCards({
  renderAction,
  currentPlan,
  trial,
}: {
  renderAction?: (plan: PlanOption) => React.ReactNode;
  /** the plan the account is on now, marked "המסלול שלך" */
  currentPlan?: string | null;
  /** show the trial card first; omit to show only the paid plans */
  trial?: TrialCardProps | null;
}) {
  return (
    <div className="space-y-6">
      <div className={cn("grid gap-4", trial ? "md:grid-cols-3" : "sm:grid-cols-2")}>
        {trial && (
          <PlanCard
            id="TRIAL"
            title={TRIAL_PLAN.title}
            price={TRIAL_PLAN.price}
            per={TRIAL_PLAN.per}
            subtitle={TRIAL_PLAN.subtitle}
            note={TRIAL_PLAN.note}
            current={!!trial.current}
            status={trial.status}
            action={trial.action}
          />
        )}
        {PLAN_OPTIONS.map((p) => (
          <PlanCard
            key={p.id}
            id={p.id}
            title={p.title}
            price={p.price}
            per={p.per}
            regularPrice={p.regularPrice}
            subtitle={`מחיר היכרות · ${PRICE_VAT_NOTE}`}
            note={p.note}
            highlight={p.highlight}
            current={currentPlan === p.id}
            action={renderAction?.(p)}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-cream-300 bg-white/60 px-5 py-4">
        <h3 className="font-display text-lg text-ink">כל המסלולים כוללים הכול</h3>
        <p className="text-sm text-ink-muted mt-0.5">
          {trial
            ? "גם מנוי ההיכרות. ההבדל בין המסלולים הוא רק באורך התקופה ובתשלום."
            : "ההבדל בין המסלולים הוא רק בתדירות התשלום."}
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

function PlanCard({
  id,
  title,
  price,
  per,
  regularPrice,
  subtitle,
  note,
  highlight,
  current,
  status,
  action,
}: {
  id: string;
  title: string;
  price: number;
  per: string;
  regularPrice?: number;
  subtitle: string;
  note: string;
  highlight?: boolean;
  current: boolean;
  status?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`plan-${id}`}
      className={cn(
        "relative rounded-2xl border px-5 py-5 flex flex-col",
        highlight ? "border-sage-300 bg-sage-50/70 shadow-soft" : "border-cream-300 bg-white/70",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 start-5 rounded-full bg-sage-600 px-3 py-0.5 text-xs font-medium text-cream-50">
          הכי משתלם
        </span>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id={`plan-${id}`} className="font-display text-xl text-ink">
          {title}
        </h2>
        {current && (
          <span className="rounded-full border border-sage-300 bg-white px-2.5 py-0.5 text-xs text-sage-700">
            המסלול שלך
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="font-display text-4xl text-ink">₪{price}</span>
        <span className="text-sm text-ink-muted">{per}</span>
        {regularPrice !== undefined && (
          <span className="text-sm text-ink-subtle line-through">₪{regularPrice}</span>
        )}
      </div>
      <p className="text-xs font-medium text-sage-700 mt-1">{subtitle}</p>
      <p className="text-sm text-ink-soft mt-3 leading-relaxed flex-1">{note}</p>
      {status && (
        <p className="mt-3 rounded-lg bg-sage-50 border border-sage-100 px-3 py-1.5 text-sm text-sage-700">
          {status}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
