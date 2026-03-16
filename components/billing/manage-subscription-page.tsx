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
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <SubscriptionSummary
          billing={billing}
          onUpdatePaymentMethod={handlePaymentMethod}
          onApplyRetentionOffer={handleApplyRetentionOffer}
          onResume={handleResume}
          busyAction={busyAction}
        />

        {!billing.subscriptionId ? (
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-base font-semibold text-white">No active subscription</h2>
            <p className="mt-1.5 text-sm text-white/55">
              Start a subscription to get access to sharp projections, props, and whale alerts.
            </p>
            <div className="mt-4">
              <Link
                href="/checkout"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-400 px-5 text-sm font-semibold text-black transition hover:bg-emerald-300"
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

            <BillingHistory invoices={billing.invoices} />

            {/* Cancel */}
            <section className="rounded-[24px] border border-red-300/10 bg-red-950/10 p-6">
              <h2 className="text-base font-semibold text-white">Cancel subscription</h2>
              <p className="mt-1.5 text-sm text-white/50">
                {billing.canResume
                  ? `Cancellation is already scheduled — your access continues through ${formatDate(billing.cancelAt) ?? 'the end of your period'}.`
                  : billing.membership.isTrial
                    ? 'Canceling during trial will revoke access immediately. Consider the 60% offer above first.'
                    : `You will keep full access through ${formatDate(billing.currentPeriodEnd) ?? 'the end of your billing period'}.`}
              </p>
              {!billing.canResume ? (
                <button
                  type="button"
                  onClick={() => setCancelStep('confirm')}
                  disabled={!billing.canCancel || busyAction === 'cancel'}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Cancel subscription
                </button>
              ) : null}
            </section>
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
