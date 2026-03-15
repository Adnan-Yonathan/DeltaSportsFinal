import { AlertCircle, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CancelSubscriptionModal({
  open,
  step,
  isTrial,
  accessEndsAt,
  busyAction,
  cancelReason,
  onCancelReasonChange,
  onClose,
  onContinue,
  onShowOffer,
  onApplyOffer,
  onConfirmCancel,
}: {
  open: boolean
  step: 'confirm' | 'offer' | 'final' | null
  isTrial: boolean
  accessEndsAt: string | null
  busyAction: string | null
  cancelReason: string
  onCancelReasonChange: (value: string) => void
  onClose: () => void
  onContinue: () => void
  onShowOffer: () => void
  onApplyOffer: () => void
  onConfirmCancel: () => void
}) {
  if (!open || !step) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,13,13,0.98),rgba(7,7,7,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-[32px] sm:p-6">
        <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <span className={cn('h-2 w-2 rounded-full', step === 'confirm' ? 'bg-white' : 'bg-white/20')} />
          <span className={cn('h-2 w-2 rounded-full', step === 'offer' ? 'bg-white' : 'bg-white/20')} />
          <span className={cn('h-2 w-2 rounded-full', step === 'final' ? 'bg-white' : 'bg-white/20')} />
        </div>

        {step === 'confirm' ? (
          <>
            <div className="rounded-full border border-red-400/30 bg-red-500/10 p-3 text-red-100">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">Are you sure you want to cancel?</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Before you continue, review the alternatives that keep your account active with less disruption. You can still return to billing at any point.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-[#3a5f47] bg-[#122016] px-4 py-2 text-sm font-semibold text-[#d0efda] transition hover:bg-[#16281c]"
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={onShowOffer}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/5"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'offer' ? (
          <>
            <div className="rounded-full border border-[#3a5f47] bg-[#122016] p-3 text-[#cdeed8]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">Stay for 60% off</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              If cost is the issue, use the retention offer instead of canceling. It applies to the next billing cycle and keeps your workflow intact.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/5"
              >
                No thanks
              </button>
              <button
                type="button"
                onClick={onApplyOffer}
                disabled={busyAction === 'retention-offer'}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-[#48785b] bg-[#c8e7d2] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d6efde] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === 'retention-offer' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply 60% off'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'final' ? (
          <>
            <div className="rounded-full border border-red-400/30 bg-red-500/10 p-3 text-red-100">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">
              {isTrial ? 'If you cancel your trial, your access will be revoked.' : 'Cancel this subscription?'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {isTrial
                ? 'You are about to end your trial. If you want to keep access, use the retention offer or stay on the current plan.'
                : `The subscription will be set not to renew at the end of the current billing window. You will keep access through ${accessEndsAt ?? 'the current period end'}.`}
            </p>
            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Reason for canceling
              </label>
              <select
                value={cancelReason}
                onChange={(event) => onCancelReasonChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
              >
                <option value="">Prefer not to say</option>
                <option value="too_expensive">Too expensive</option>
                <option value="not_using_enough">Not using it enough</option>
                <option value="missing_features">Missing features</option>
                <option value="switching_tools">Switching tools</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-[#3a5f47] bg-[#122016] px-4 py-2 text-sm font-semibold text-[#d0efda] transition hover:bg-[#16281c]"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={onConfirmCancel}
                disabled={busyAction === 'cancel'}
                className="inline-flex min-h-[46px] w-full flex-1 items-center justify-center rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, cancel'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
