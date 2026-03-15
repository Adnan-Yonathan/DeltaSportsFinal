import type Stripe from 'stripe'
import type { MembershipInfo, MembershipStatus } from '@/lib/utils/membership'
import type { PlanKey } from '@/lib/stripe'

export interface BillingPaymentMethodSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export interface BillingInvoiceSummary {
  id: string
  amountPaid: number
  currency: string
  status: string | null
  createdAt: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

export interface BillingRetentionOffer {
  eligible: boolean
  couponId: string | null
  percentOff: number | null
  duration: string | null
  alreadyDiscounted: boolean
}

export interface BillingSnapshot {
  membership: MembershipInfo
  email: string | null
  customerId: string | null
  subscriptionId: string | null
  status: MembershipStatus | null
  currentPeriodEnd: string | null
  cancelAt: string | null
  planKey: PlanKey | null
  planLabel: string | null
  priceId: string | null
  interval: Stripe.Price.Recurring.Interval | null
  amount: number | null
  currency: string | null
  paymentMethod: BillingPaymentMethodSummary | null
  invoices: BillingInvoiceSummary[]
  canCancel: boolean
  canChangePlan: boolean
  canResume: boolean
  canUpdatePaymentMethod: boolean
  retentionOffer: BillingRetentionOffer
}

export interface BillingSnapshotResponse {
  billing: BillingSnapshot
}
