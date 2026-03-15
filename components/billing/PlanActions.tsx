import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BillingSnapshot } from '@/lib/types/billing'
import type { PlanKey } from '@/lib/stripe'
import { PLAN_OPTIONS, formatCurrency, getPlanTier } from '@/components/billing/billing-ui'

export default function PlanActions({
  billing,
  busyAction,
  onChangePlan,
}: {
  billing: BillingSnapshot
  busyAction: string | null
  onChangePlan: (planKey: PlanKey) => void
}) {
  const currentTier = getPlanTier(billing.planKey)
  const currentPlan = PLAN_OPTIONS.find((plan) => plan.planKey === billing.planKey) ?? null
  const suggestedPlans = PLAN_OPTIONS.filter((plan) => {
    if (!billing.canChangePlan) return plan.planKey === billing.planKey
    if (plan.planKey === billing.planKey) return true
    if (currentTier === 'syndicate') {
      return plan.tier === 'syndicate' || plan.planKey === 'sharp_monthly'
    }
    return plan.tier === 'sharp' || plan.planKey === 'syndicate_monthly'
  })

  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
            Plan Options
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">Switch plans before you cancel</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            Compare the current plan with the closest billing alternatives. Choose a lighter cadence, upgrade capacity, or move to a longer-term rate without leaving the app.
          </p>
        </div>
        {!billing.canChangePlan ? (
          <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
            {billing.membership.isTrial ? 'Plan changes disabled during trial' : 'Plan changes unavailable'}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suggestedPlans.map((plan) => {
          const isCurrent = billing.planKey === plan.planKey
          const isLoading = busyAction === `change-${plan.planKey}`
          const isLowerCost = currentPlan ? plan.price < currentPlan.price : false

          return (
            <div
              key={plan.planKey}
              className={cn(
                'rounded-[28px] border p-5 transition',
                isCurrent ? 'border-[#4a7a5d] bg-[#111b15]' : 'border-white/10 bg-black/25'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{plan.name}</div>
                  <div className="mt-1 text-sm leading-6 text-white/55">{plan.summary}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isCurrent ? <PlanBadge label="Current" tone="active" /> : null}
                  {!isCurrent && isLowerCost ? <PlanBadge label="Lower cost" tone="neutral" /> : null}
                </div>
              </div>

              <div className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">
                {formatCurrency(plan.price)}
                <span className="ml-1 text-sm font-medium text-white/50">/{plan.cadence}</span>
              </div>

              <button
                type="button"
                onClick={() => onChangePlan(plan.planKey)}
                disabled={!billing.canChangePlan || isCurrent || isLoading}
                className={cn(
                  'mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                  isCurrent
                    ? 'border-white/10 bg-white/5 text-white/55'
                    : 'border-white/15 bg-white text-black hover:bg-white/90'
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? 'Current plan' : 'Switch to this plan'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PlanBadge({
  label,
  tone,
}: {
  label: string
  tone: 'active' | 'neutral'
}) {
  return (
    <div
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]',
        tone === 'active' ? 'bg-[#bce0c9] text-black' : 'bg-white/10 text-white/70'
      )}
    >
      {label}
    </div>
  )
}
