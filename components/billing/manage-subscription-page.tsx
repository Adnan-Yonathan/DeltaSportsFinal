'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PlanKey } from '@/lib/stripe'
import type { BillingSnapshot } from '@/lib/types/billing'
import SubscriptionSummary from '@/components/billing/SubscriptionSummary'
import PlanActions from '@/components/billing/PlanActions'
import BillingHistory from '@/components/billing/BillingHistory'
import CancelSubscriptionModal from '@/components/billing/CancelSubscriptionModal'
import { formatDate } from '@/components/billing/billing-ui'

type ToastState =
  | {
      tone: 'success' | 'error'
      text: string
    }
  | null

type CancelStep = 'confirm' | 'offer' | 'final' | null

export default function ManageSubscriptionPage({
  billing,
  paymentMethodUpdated,
}: {
  billing: BillingSnapshot
  paymentMethodUpdated?: boolean
}) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [cancelStep, setCancelStep] = useState<CancelStep>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (paymentMethodUpdated) {
      setToast({
        tone: 'success',
        text: 'Your payment method was updated in Stripe.',
      })
    }
  }, [paymentMethodUpdated])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const runRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const postAction = async (
    url: string,
    actionKey: string,
    body?: Record<string, unknown>
  ) => {
    setBusyAction(actionKey)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await response.json().catch(() => null)) as { error?: string; url?: string } | null

      if (!response.ok) {
        throw new Error(data?.error || 'Request failed')
      }

      return data
    } finally {
      setBusyAction(null)
    }
  }

  const handlePaymentMethod = async () => {
    try {
      const data = await postAction('/api/stripe/billing-portal', 'payment-method', {
        flow: 'payment_method_update',
      })
      if (data?.url) {
        window.location.assign(data.url)
      }
    } catch (error) {
      setToast({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to open Stripe.',
      })
    }
  }

  const handlePlanChange = async (planKey: PlanKey) => {
    try {
      await postAction('/api/stripe/change-plan', `change-${planKey}`, { planKey })
      setToast({
        tone: 'success',
        text: 'Plan updated. Stripe will recalculate the billing change automatically.',
      })
      runRefresh()
    } catch (error) {
      setToast({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to change plan.',
      })
    }
  }

  const handleApplyRetentionOffer = async () => {
    try {
      await postAction('/api/stripe/apply-retention-offer', 'retention-offer')
      setCancelStep(null)
      setToast({
        tone: 'success',
        text: 'The 60% retention offer was applied to your next billing cycle.',
      })
      runRefresh()
    } catch (error) {
      setToast({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to apply the retention offer.',
      })
    }
  }

  const handleCancel = async () => {
    try {
      await postAction('/api/stripe/cancel', 'cancel', {
        ...(cancelReason ? { reason: cancelReason } : {}),
      })
      setCancelStep(null)
      setCancelReason('')
      setToast({
        tone: 'success',
        text: 'Your cancellation has been scheduled.',
      })
      runRefresh()
    } catch (error) {
      setToast({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to cancel the subscription.',
      })
    }
  }

  const handleResume = async () => {
    try {
      await postAction('/api/stripe/reactivate', 'resume')
      setToast({
        tone: 'success',
        text: 'Your scheduled cancellation was removed.',
      })
      runRefresh()
    } catch (error) {
      setToast({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to resume the subscription.',
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <SubscriptionSummary
          billing={billing}
          onUpdatePaymentMethod={handlePaymentMethod}
          onApplyRetentionOffer={handleApplyRetentionOffer}
          onResume={handleResume}
          busyAction={busyAction}
        />

        {!billing.subscriptionId ? (
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold text-white">No active subscription</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              There is no active subscription attached to this account right now. You can start from checkout when you are ready.
            </p>
            <div className="mt-5">
              <Link
                href="/checkout"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#3f6c4f] bg-[#bce0c9] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#ccead5]"
              >
                Go to checkout
              </Link>
            </div>
          </section>
        ) : (
          <>
            <PlanActions
              billing={billing}
              busyAction={busyAction}
              onChangePlan={handlePlanChange}
            />

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <BillingHistory invoices={billing.invoices} />

              <section className="rounded-[30px] border border-red-300/10 bg-[linear-gradient(180deg,rgba(38,9,9,0.24),rgba(10,10,10,0.72))] p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100/45">
                  Cancellation
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">Cancel with a clear record of what happens next</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Review the timeline before you continue. Payment method updates, plan changes, and the retention offer remain available above if you want to keep the account active.
                </p>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/25 p-5">
                  <div className="text-sm font-semibold text-white">
                    {billing.membership.isTrial
                      ? 'Trial cancellation'
                      : billing.canResume
                        ? 'Cancellation already scheduled'
                        : 'Before canceling'}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/58">
                    {billing.membership.isTrial
                      ? 'The cancellation flow warns trial users that access will be revoked if they continue. Review the retention offer before you make that choice.'
                      : billing.canResume
                        ? `Your subscription is set to end on ${formatDate(billing.cancelAt) ?? 'the scheduled date'}. You can reactivate it any time before then.`
                        : `Cancellation is scheduled for the end of the current billing period. You will keep access through ${formatDate(billing.currentPeriodEnd) ?? 'the current period end'}.`}
                  </div>
                  {!billing.canResume ? (
                    <button
                      type="button"
                      onClick={() => setCancelStep('confirm')}
                      disabled={!billing.canCancel || busyAction === 'cancel'}
                      className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open cancellation flow'}
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      <BillingToast toast={toast} />

      <CancelSubscriptionModal
        open={cancelStep !== null}
        step={cancelStep}
        isTrial={billing.membership.isTrial}
        accessEndsAt={formatDate(billing.currentPeriodEnd)}
        busyAction={busyAction}
        cancelReason={cancelReason}
        onCancelReasonChange={setCancelReason}
        onClose={() => {
          setCancelStep(null)
          setCancelReason('')
        }}
        onContinue={() => setCancelStep('final')}
        onShowOffer={() => setCancelStep('offer')}
        onApplyOffer={handleApplyRetentionOffer}
        onConfirmCancel={handleCancel}
      />
    </main>
  )
}

function BillingToast({
  toast,
}: {
  toast: ToastState
}) {
  if (!toast) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[90] flex justify-center sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm sm:justify-end">
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.45)] ${
          toast.tone === 'success'
            ? 'border-[#335941] bg-[#0f1914] text-[#d4f4de]'
            : 'border-red-400/25 bg-[#2a0e0e] text-red-100'
        } w-full sm:w-auto`}
      >
        {toast.tone === 'success' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  )
}
