import type { PlanKey } from '@/lib/stripe'
import type { BillingSnapshot } from '@/lib/types/billing'

export const PLAN_OPTIONS: Array<{
  planKey: PlanKey
  name: string
  price: number
  cadence: string
  summary: string
  tier: 'sharp' | 'syndicate'
}> = [
  { planKey: 'sharp_weekly', name: 'Sharp Weekly', price: 19.99, cadence: 'week', summary: 'Flexible access to projections and props.', tier: 'sharp' },
  { planKey: 'sharp_monthly', name: 'Sharp Monthly', price: 59, cadence: 'month', summary: 'Lower weekly cost for steady usage.', tier: 'sharp' },
  { planKey: 'sharp_annual', name: 'Sharp Annual', price: 249, cadence: 'year', summary: 'Best long-term rate for Sharp tools.', tier: 'sharp' },
  { planKey: 'syndicate_weekly', name: 'Syndicate Weekly', price: 24.99, cadence: 'week', summary: 'Full access with a short commitment.', tier: 'syndicate' },
  { planKey: 'syndicate_monthly', name: 'Syndicate Monthly', price: 79, cadence: 'month', summary: 'Full access with a balanced billing cycle.', tier: 'syndicate' },
  { planKey: 'syndicate_annual', name: 'Syndicate Annual', price: 299, cadence: 'year', summary: 'Best overall value for full access.', tier: 'syndicate' },
]

export const formatCurrency = (amount: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)

export const formatDate = (value: string | null) => {
  if (!value) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export const formatStatus = (value: string | null) => {
  if (!value) return 'No active subscription'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const cadenceShortLabel = (value: string | null) => {
  if (value === 'year') return 'yr'
  if (value === 'month') return 'mo'
  if (value === 'week') return 'wk'
  return value ?? ''
}

export const getStatusTone = (billing: BillingSnapshot) => {
  if (billing.canResume) return 'warning' as const
  if (billing.membership.isTrial) return 'trial' as const
  if (billing.membership.isPayingCustomer) return 'active' as const
  return 'neutral' as const
}

export const getPlanTier = (planKey: PlanKey | null) => {
  if (!planKey) return null
  return planKey.startsWith('syndicate') ? 'syndicate' : 'sharp'
}
