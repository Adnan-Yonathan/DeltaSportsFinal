import type Stripe from 'stripe'
import type { User } from '@supabase/supabase-js'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import { getMembershipStatusFromMetadata, type MembershipStatus } from '@/lib/utils/membership'
import type { BillingPaymentMethodSummary, BillingSnapshot } from '@/lib/types/billing'

export type {
  BillingInvoiceSummary,
  BillingPaymentMethodSummary,
  BillingRetentionOffer,
  BillingSnapshot,
  BillingSnapshotResponse,
} from '@/lib/types/billing'

const RETENTION_COUPON_NAME = 'Pro Subscriber Discount'
let retentionCouponPromise: Promise<Stripe.Coupon | null> | null = null

// Requires STRIPE_SECRET_KEY. Optionally set STRIPE_RETENTION_COUPON_ID to avoid
// scanning Stripe coupons when resolving the retention offer.

const getPriceIdEntries = () => Object.entries(PRICE_IDS) as Array<[PlanKey, string | undefined]>

const getPlanKeyForPriceId = (priceId: string | null | undefined): PlanKey | null => {
  if (!priceId) return null

  for (const [planKey, configuredPriceId] of getPriceIdEntries()) {
    if (configuredPriceId === priceId) {
      return planKey
    }
  }

  return null
}

const getPaymentMethodSummary = (
  paymentMethod: Stripe.PaymentMethod | string | null | undefined
): BillingPaymentMethodSummary | null => {
  if (!paymentMethod || typeof paymentMethod === 'string' || paymentMethod.type !== 'card' || !paymentMethod.card) {
    return null
  }

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  }
}

const getStatusRank = (status: Stripe.Subscription.Status) => {
  switch (status) {
    case 'active':
      return 0
    case 'trialing':
      return 1
    case 'past_due':
      return 2
    case 'unpaid':
      return 3
    case 'incomplete':
      return 4
    case 'incomplete_expired':
      return 5
    case 'paused':
      return 6
    case 'canceled':
      return 7
    default:
      return 99
  }
}

export const resolveManagedSubscription = async (
  customerId: string,
  subscriptionId?: string | null
) => {
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const subscriptionCustomerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

      if (subscriptionCustomerId === customerId) {
        return subscription
      }

      console.warn('[STRIPE_BILLING] Ignoring subscription that does not belong to customer:', {
        customerId,
        subscriptionId,
      })
    } catch (error) {
      console.warn('[STRIPE_BILLING] Failed to retrieve subscription by metadata ID:', error)
    }
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  return [...subscriptions.data].sort((left, right) => {
    const rankDiff = getStatusRank(left.status) - getStatusRank(right.status)
    if (rankDiff !== 0) return rankDiff
    return right.created - left.created
  })[0] ?? null
}

const resolveRetentionCoupon = async (): Promise<Stripe.Coupon | null> => {
  if (retentionCouponPromise) {
    return retentionCouponPromise
  }

  retentionCouponPromise = (async () => {
    if (process.env.STRIPE_RETENTION_COUPON_ID) {
      try {
        return await stripe.coupons.retrieve(process.env.STRIPE_RETENTION_COUPON_ID)
      } catch (error) {
        console.warn('[STRIPE_BILLING] Failed to retrieve retention coupon from env:', error)
      }
    }

    const coupons = await stripe.coupons.list({ limit: 100 })
    return (
      coupons.data.find(
        (coupon) =>
          coupon.valid &&
          coupon.percent_off === 60 &&
          coupon.duration === 'once' &&
          coupon.name === RETENTION_COUPON_NAME
      ) ?? null
    )
  })()

  return retentionCouponPromise
}

export const getRetentionCouponId = async () => {
  const coupon = await resolveRetentionCoupon()
  return coupon?.id ?? null
}

export const getBillingSnapshotForUser = async (user: User): Promise<BillingSnapshot> => {
  // The authenticated app user is the only source for Stripe customer lookup here.
  // If your auth model stores the customer elsewhere, replace this metadata lookup.
  const membership = getMembershipStatusFromMetadata(user.user_metadata)
  const customerId = (user.user_metadata?.stripe_customer_id as string | undefined) ?? null
  const metadataSubscriptionId =
    (user.user_metadata?.stripe_subscription_id as string | undefined) ?? null
  const retentionCoupon = await resolveRetentionCoupon()

  if (!customerId) {
    return {
      membership,
      email: user.email ?? null,
      customerId: null,
      subscriptionId: metadataSubscriptionId,
      status: membership.status,
      currentPeriodEnd: membership.currentPeriodEnd?.toISOString() ?? null,
      cancelAt: membership.cancelAt?.toISOString() ?? null,
      planKey: null,
      planLabel: null,
      priceId: null,
      interval: null,
      amount: null,
      currency: null,
      paymentMethod: null,
      invoices: [],
      canCancel: false,
      canChangePlan: false,
      canResume: false,
      canUpdatePaymentMethod: false,
      retentionOffer: {
        eligible: false,
        couponId: retentionCoupon?.id ?? null,
        percentOff: retentionCoupon?.percent_off ?? null,
        duration: retentionCoupon?.duration ?? null,
        alreadyDiscounted: false,
      },
    }
  }

  const [customer, subscription, invoices] = await Promise.all([
    stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    }),
    resolveManagedSubscription(customerId, metadataSubscriptionId),
    stripe.invoices.list({ customer: customerId, limit: 6 }),
  ])

  const subscriptionPaymentMethod =
    subscription?.default_payment_method &&
    typeof subscription.default_payment_method === 'string'
      ? await stripe.paymentMethods.retrieve(subscription.default_payment_method)
      : subscription?.default_payment_method ?? null

  const currentPrice = subscription?.items.data[0]?.price ?? null
  const paymentMethod =
    getPaymentMethodSummary(subscriptionPaymentMethod as Stripe.PaymentMethod | string | null | undefined) ||
    (!customer.deleted
      ? getPaymentMethodSummary(
          customer.invoice_settings?.default_payment_method as
            | Stripe.PaymentMethod
            | string
            | null
            | undefined
        )
      : null)
  const planKey =
    (subscription?.metadata?.plan_key as PlanKey | undefined) ??
    getPlanKeyForPriceId(currentPrice?.id ?? null)
  const planLabel = planKey ? PLAN_CONFIG[planKey].label : null
  const alreadyDiscounted = Boolean(subscription?.discounts?.length)

  return {
    membership,
    email: user.email ?? null,
    customerId,
    subscriptionId: subscription?.id ?? metadataSubscriptionId,
    status: (subscription?.status as MembershipStatus | undefined) ?? membership.status,
    currentPeriodEnd: (subscription as any)?.current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : membership.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: subscription?.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : membership.cancelAt?.toISOString() ?? null,
    planKey: planKey ?? null,
    planLabel,
    priceId: currentPrice?.id ?? null,
    interval: currentPrice?.recurring?.interval ?? null,
    amount: currentPrice?.unit_amount ?? null,
    currency: currentPrice?.currency ?? null,
    paymentMethod,
    invoices: invoices.data.map((invoice) => ({
      id: invoice.id,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
    })),
    canCancel: Boolean(subscription) && ['active', 'trialing', 'past_due', 'unpaid'].includes(subscription.status),
    canChangePlan:
      Boolean(subscription) &&
      subscription.status !== 'canceled' &&
      subscription.status !== 'trialing' &&
      subscription.items.data.length === 1,
    canResume: Boolean(subscription) && Boolean(subscription.cancel_at_period_end),
    canUpdatePaymentMethod: Boolean(subscription) || Boolean(paymentMethod),
    retentionOffer: {
      eligible:
        Boolean(subscription) &&
        subscription.status !== 'canceled' &&
        Boolean(retentionCoupon?.id) &&
        !alreadyDiscounted,
      couponId: retentionCoupon?.id ?? null,
      percentOff: retentionCoupon?.percent_off ?? null,
      duration: retentionCoupon?.duration ?? null,
      alreadyDiscounted,
    },
  }
}
