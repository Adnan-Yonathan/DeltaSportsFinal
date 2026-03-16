import { AlertCircle, CalendarClock, CreditCard, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BillingSnapshot } from '@/lib/types/billing'
import { cadenceShortLabel, formatCurrency, formatDate, formatStatus } from '@/components/billing/billing-ui'

export default function SubscriptionSummary({
  billing,
  onUpdatePaymentMethod,
  onApplyRetentionOffer,
  onResume,
  busyAction,
}: {
  billing: BillingSnapshot
  onUpdatePaymentMethod: () => void
  onApplyRetentionOffer: () => void
  onResume: () => void
  busyAction: string | null
}) {
  const nextBillingDate = formatDate(billing.currentPeriodEnd)
  const cancelDate = formatDate(billing.cancelAt)
  const statusTone = billing.canResume ? 'warning' : billing.membership.isTrial ? 'trial' : 'active'

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.08),rgba(0,0,0,0.7)_55%)] p-6 sm:p-8">
      {/* Page title */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Manage subscription</h1>
          <p className="text-xs text-white/45">{billing.email ?? 'Your Delta account'}</p>
        </div>
      </div>

      {/* Plan summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Current plan */}
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Current Plan</div>
          <div className="mt-2 text-xl font-semibold text-white">{billing.planLabel ?? 'No active plan'}</div>
          <div className="mt-1 text-sm text-white/50">
            {billing.amount && billing.currency
              ? `${formatCurrency(billing.amount / 100, billing.currency)} / ${cadenceShortLabel(billing.interval)}`
              : '—'}
          </div>
        </div>

        {/* Status */}
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Status</div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                statusTone === 'active' ? 'bg-emerald-400' :
                statusTone === 'trial' ? 'bg-sky-400' :
                'bg-amber-400'
              )}
            />
            <span className="text-base font-semibold text-white">{formatStatus(billing.status)}</span>
          </div>
          <div className="mt-1 text-xs text-white/45">
            {billing.membership.isTrial ? 'Free trial active' : billing.membership.isPayingCustomer ? 'Paid member' : 'Not yet billed'}
          </div>
        </div>

        {/* Next billing / cancel date */}
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
            {billing.canResume ? 'Cancels On' : 'Next Billing'}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-white/40" />
            <span className="text-base font-semibold text-white">
              {(billing.canResume ? cancelDate : nextBillingDate) ?? '—'}
            </span>
          </div>
          <div className="mt-1 text-xs text-white/45">
            {billing.paymentMethod
              ? `${billing.paymentMethod.brand.toUpperCase()} ···· ${billing.paymentMethod.last4}`
              : 'Card managed in Stripe'}
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {(billing.canResume || billing.membership.isTrial) ? (
        <div
          className={cn(
            'mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3',
            billing.canResume
              ? 'border-amber-300/20 bg-amber-500/8'
              : 'border-emerald-300/20 bg-emerald-500/8'
          )}
        >
          {billing.canResume
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
          <p className="text-sm text-white/70">
            {billing.canResume
              ? `Your subscription is scheduled to cancel on ${cancelDate ?? 'the end of the period'}. You still have full access until then.`
              : 'You\'re on a free trial. Your card will be charged when the trial ends unless you cancel first.'}
          </p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        <ActionButton
          label="Update payment method"
          icon={<CreditCard className="h-3.5 w-3.5" />}
          loading={busyAction === 'payment-method'}
          disabled={busyAction === 'payment-method'}
          onClick={onUpdatePaymentMethod}
          tone="primary"
        />
        {billing.retentionOffer?.eligible && !billing.canResume ? (
          <ActionButton
            label="Apply 60% discount"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            loading={busyAction === 'retention-offer'}
            disabled={busyAction === 'retention-offer'}
            onClick={onApplyRetentionOffer}
            tone="secondary"
          />
        ) : null}
        {billing.canResume ? (
          <ActionButton
            label="Keep subscription active"
            loading={busyAction === 'resume'}
            disabled={busyAction === 'resume'}
            onClick={onResume}
            tone="accent"
          />
        ) : null}
      </div>
    </section>
  )
}

function ActionButton({
  label,
  icon,
  loading,
  disabled,
  onClick,
  tone,
}: {
  label: string
  icon?: React.ReactNode
  loading: boolean
  disabled: boolean
  onClick: () => void
  tone: 'primary' | 'secondary' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary'
          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
          : tone === 'accent'
            ? 'border-white/20 bg-white text-black hover:bg-white/90'
            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {loading ? 'Working…' : label}
    </button>
  )
}
