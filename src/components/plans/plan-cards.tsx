import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AVAILABLE_PLAN_BADGE,
  FUTURE_PLAN_BADGE,
  FUTURE_PLAN_PRICE_NOTE,
  PLAN_FACTS,
  PLAN_OPTIONS,
  PLAN_TIERS,
  TRIAL_PLAN,
  type PlanOption,
  type PlanTier,
} from "@/lib/plans";

/** The free-trial option ("מנוי היכרות"), shown first when passed. */
export type TrialCardProps = {
  /** the account is in its trial now — marked "המנוי שלך" */
  current?: boolean;
  /** a short status line on the card, e.g. the days left */
  status?: string | null;
  /** a button/link under the card (e.g. register on the public page) */
  action?: React.ReactNode;
};

type Level = 2 | 3;

/**
 * The plans ("מסלולים"), from PLAN_TIERS: the one sold today — "ניהול
 * קליניקה", with its ✓ list and the ways to pay for it (the free trial when
 * `trial` is passed, then monthly / yearly) — and under it the two future
 * plans, which have a badge and a line in place of a price and never a button.
 * Then the short rules. Shared by the home page (#plans), /pricing and the
 * in-app /subscription page; `renderAction` puts each paid option's button
 * (buy / request) under it.
 */
export function PlanCards({
  renderAction,
  currentPlan,
  trial,
  headingLevel = 2,
}: {
  renderAction?: (plan: PlanOption) => React.ReactNode;
  /** the paid option the account is on now, marked "המנוי שלך" */
  currentPlan?: string | null;
  /** show the trial option first; omit to show only the paid ones */
  trial?: TrialCardProps | null;
  /** the level of the plan names: 2 under a page's h1, 3 inside a section that has an h2 */
  headingLevel?: Level;
}) {
  const [available, ...future] = PLAN_TIERS;
  const Title = `h${headingLevel}` as "h2" | "h3";
  const OptionTitle = `h${headingLevel + 1}` as "h3" | "h4";

  return (
    <div className="space-y-6">
      <section
        aria-labelledby={`plan-${available.id}`}
        className="rounded-2xl border border-sage-300 bg-sage-50/70 shadow-soft px-4 py-5 sm:px-6 sm:py-6"
      >
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <Title id={`plan-${available.id}`} className="font-display text-2xl text-ink">
            {available.title}
          </Title>
          <span className="rounded-full bg-sage-600 px-3 py-0.5 text-xs font-medium text-cream-50">
            {AVAILABLE_PLAN_BADGE}
          </span>
        </div>

        <FeatureList tier={available} className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2" />

        <div className={cn("mt-6 grid gap-4", trial ? "md:grid-cols-3" : "sm:grid-cols-2")}>
          {trial && (
            <PayOption
              Heading={OptionTitle}
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
            <PayOption
              Heading={OptionTitle}
              key={p.id}
              id={p.id}
              title={p.title}
              price={p.price}
              per={p.per}
              regularPrice={p.regularPrice}
              subtitle="מחיר היכרות"
              note={p.note}
              highlight={p.highlight}
              current={currentPlan === p.id}
              action={renderAction?.(p)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {future.map((tier) => (
          <section
            key={tier.id}
            aria-labelledby={`plan-${tier.id}`}
            className="rounded-2xl border border-dashed border-cream-400 bg-white/50 px-4 py-5 sm:px-5 flex flex-col"
          >
            <span className="self-start rounded-full border border-gold-400 bg-gold-200/60 px-3 py-0.5 text-xs font-medium text-ink-soft">
              {FUTURE_PLAN_BADGE}
            </span>
            <Title id={`plan-${tier.id}`} className="mt-3 font-display text-xl text-ink-soft leading-snug">
              {tier.title}
            </Title>
            <p className="mt-2 text-sm font-medium text-ink-muted">{FUTURE_PLAN_PRICE_NOTE}</p>
            <FeatureList tier={tier} muted className="mt-4 space-y-2" />
          </section>
        ))}
      </div>

      <ul className="space-y-1.5 text-sm text-ink-soft list-disc ps-5">
        {PLAN_FACTS.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

function FeatureList({
  tier,
  muted,
  className,
}: {
  tier: PlanTier;
  muted?: boolean;
  className?: string;
}) {
  return (
    <ul className={className}>
      {tier.features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
          <Check
            aria-hidden
            className={cn("w-4 h-4 mt-0.5 shrink-0", muted ? "text-ink-subtle" : "text-sage-600")}
          />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

/** One way to pay for the available plan: the free trial, monthly or yearly. */
function PayOption({
  Heading,
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
  Heading: "h3" | "h4";
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
        "relative rounded-2xl border px-5 py-5 flex flex-col bg-white/80",
        highlight ? "border-sage-300 shadow-soft" : "border-cream-300",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 start-5 rounded-full bg-sage-600 px-3 py-0.5 text-xs font-medium text-cream-50">
          הכי משתלם
        </span>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Heading id={`plan-${id}`} className="font-display text-xl text-ink">
          {title}
        </Heading>
        {current && (
          <span className="rounded-full border border-sage-300 bg-white px-2.5 py-0.5 text-xs text-sage-700">
            המנוי שלך
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="font-display text-4xl text-ink">₪{price}</span>
        <span className="text-sm text-ink-muted">{per}</span>
        {regularPrice !== undefined && (
          <span className="text-sm text-ink-subtle line-through">
            <span className="sr-only">מחיר רגיל: </span>₪{regularPrice}
          </span>
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
