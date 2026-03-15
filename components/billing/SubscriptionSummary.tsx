import { AlertCircle, CalendarClock, CreditCard, Loader2, Sparkles } from 'lucide-react'
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

  return (
    <>
      <section className="overflow-hidden rounded-[36px] border border-[#24322b] bg-[radial-gradient(circle_at_top_left,rgba(87,194,138,0.16),rgba(12,12,12,0.98)_48%)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-[#32523d] bg-[#0f1a14] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9fd0af]">
              Billing
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Manage your subscription
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/64 sm:text-base">
                Review your plan, billing cadence, payment method, and invoice history in one place. Core account changes stay in-app, while Stripe handles secure payment method updates.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/30 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                  Current Subscription
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {billing.planLabel ?? 'No active plan'}
                </div>
                <div className="mt-1 text-sm text-white/56">
                  {billing.amount && billing.currency
                    ? `${formatCurrency(billing.amount / 100, billing.currency)}/${cadenceShortLabel(billing.interval)}`
                    : 'No active billing amount'}
                </div>
              </div>
              <div className="rounded-2xl border border-[#32523d] bg-[#0d1611] px-3 py-2 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98d1ac]">
                  {billing.canResume ? 'Cancels On' : 'Next Billing'}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {(billing.canResume ? cancelDate : nextBillingDate) ?? 'N/A'}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <QuickMetric
                label="Status"
                value={formatStatus(billing.status)}
                detail={
                  billing.membership.isTrial
                    ? 'Trial is active'
                    : billing.membership.isPayingCustomer
                      ? 'At least one successful payment recorded'
                      : 'No successful payment recorded yet'
                }
              />
              <QuickMetric
                label="Payment Method"
                value={
                  billing.paymentMethod
                    ? `${billing.paymentMethod.brand.toUpperCase()} ${billing.paymentMethod.last4}`
                    : 'Managed in Stripe'
                }
                detail={
                  billing.paymentMethod
                    ? `Exp ${billing.paymentMethod.expMonth}/${billing.paymentMethod.expYear}`
                    : 'Open Stripe to review card details'
                }
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionButton
                label="Update payment method"
                loading={busyAction === 'payment-method'}
                disabled={busyAction === 'payment-method'}
                onClick={onUpdatePaymentMethod}
                tone="primary"
              />
              {billing.canResume ? (
                <ActionButton
                  label="Keep subscription active"
                  loading={busyAction === 'resume'}
                  disabled={busyAction === 'resume'}
                  onClick={onResume}
                  tone="secondary"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                Subscription Overview
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Subscription overview</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                Review what renews next, how the account is billed, and which billing actions are currently available.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoPanel
              title="Renewal timeline"
              icon={<CalendarClock className="h-4 w-4" />}
              rows={[
                {
                  label: billing.canResume ? 'Scheduled cancel date' : 'Current period end',
                  value: billing.canResume ? cancelDate ?? 'N/A' : nextBillingDate ?? 'N/A',
                },
                {
                  label: 'Account email',
                  value: billing.email ?? 'N/A',
                },
                {
                  label: 'Plan status',
                  value: formatStatus(billing.status),
                },
              ]}
            />
            <InfoPanel
              title="Payment details"
              icon={<CreditCard className="h-4 w-4" />}
              rows={[
                {
                  label: 'Card',
                  value: billing.paymentMethod
                    ? `${billing.paymentMethod.brand.toUpperCase()} ending in ${billing.paymentMethod.last4}`
                    : 'Managed in Stripe',
                },
                {
                  label: 'Expires',
                  value: billing.paymentMethod
                    ? `${billing.paymentMethod.expMonth}/${billing.paymentMethod.expYear}`
                    : 'Open Stripe to review',
                },
                {
                  label: 'Billing amount',
                  value:
                    billing.amount && billing.currency
                      ? `${formatCurrency(billing.amount / 100, billing.currency)}/${cadenceShortLabel(billing.interval)}`
                      : 'N/A',
                },
              ]}
            />
          </div>

          {(billing.canResume || billing.membership.isTrial) ? (
            <div
              className={cn(
                'mt-6 rounded-[24px] border px-5 py-4',
                billing.canResume ? 'border-amber-300/20 bg-amber-500/10' : 'border-[#335941] bg-[#0f1914]'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'rounded-full p-2',
                    billing.canResume ? 'bg-amber-200/12 text-amber-100' : 'bg-[#1a2c22] text-[#a7dab8]'
                  )}
                >
                  {billing.canResume ? <AlertCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {billing.canResume
                      ? 'Cancellation is already scheduled'
                      : billing.membership.isTrial
                        ? 'Trial accounts should review cancellation carefully'
                        : 'Subscription is in good standing'}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white/62">
                    {billing.canResume
                      ? 'You still have access for the remainder of the current billing window. If the cancellation was a mistake, keep the subscription active before the end date.'
                      : billing.membership.isTrial
                        ? 'If you are considering canceling during trial, review the retention offer or a different plan first.'
                        : 'Most billing issues can be resolved by updating your payment method or changing plans instead of canceling.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
            Recommended actions
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {billing.canResume ? 'Remove the scheduled cancellation' : 'Keep billing current without disruption'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Common account changes are available here first so you can resolve billing issues quickly without leaving the app.
          </p>

          <div className="mt-6 space-y-4">
            {!billing.canResume ? (
              <>
                <ActionCard
                  title="Update payment method on Stripe"
                  body="Fix expiring cards, failed payments, or wallet changes without changing your plan."
                  buttonLabel="Open Stripe"
                  loading={busyAction === 'payment-method'}
                  onClick={onUpdatePaymentMethod}
                  tone="primary"
                />
                {billing.retentionOffer.eligible ? (
                  <ActionCard
                    title="Hold onto access with 60% off"
                    body="If cost is the issue, keep the subscription and apply the next-cycle discount instead of canceling."
                    buttonLabel="Use 60% offer"
                    loading={busyAction === 'retention-offer'}
                    onClick={onApplyRetentionOffer}
                    tone="secondary"
                  />
                ) : null}
              </>
            ) : (
              <ActionCard
                title="Keep the subscription active"
                body="The cancellation is only scheduled. Remove it now and keep the account unchanged."
                buttonLabel="Keep subscription"
                loading={busyAction === 'resume'}
                onClick={onResume}
                tone="primary"
              />
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function QuickMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">{label}</div>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/52">{detail}</div>
    </div>
  )
}

function InfoPanel({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/25 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="rounded-full border border-[#365745] bg-[#101912] p-2 text-[#bfe2ca]">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="text-sm text-white/55">{row.label}</div>
            <div className="text-sm font-semibold text-white sm:text-right">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionCard({
  title,
  body,
  buttonLabel,
  loading,
  onClick,
  tone,
}: {
  title: string
  body: string
  buttonLabel: string
  loading: boolean
  onClick?: () => void
  tone: 'primary' | 'secondary'
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border p-5',
        tone === 'primary' ? 'border-[#446d53] bg-[#101913]' : 'border-white/10 bg-black/25'
      )}
    >
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/58">{body}</div>
      <ActionButton
        label={buttonLabel}
        loading={loading}
        disabled={loading || !onClick}
        onClick={onClick ?? (() => {})}
        tone={tone === 'primary' ? 'primary' : 'secondary'}
      />
    </div>
  )
}

function ActionButton({
  label,
  loading,
  disabled,
  onClick,
  tone,
}: {
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  tone: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto',
        tone === 'primary'
          ? 'border-[#4f805f] bg-[#c8e7d2] text-black hover:bg-[#d6efde]'
          : 'border-white/12 bg-white/5 text-white hover:bg-white/10'
      )}
    >
      {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Working</span> : label}
    </button>
  )
}
