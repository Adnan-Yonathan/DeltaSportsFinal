import { stripe } from '@/lib/stripe'

const TRIAL_FEE_CENTS = 100 // $1.00
const TRIAL_FEE_CURRENCY = 'usd'
const TRIAL_FEE_PRODUCT_NAME = 'Trial Activation Fee'
const TRIAL_FEE_COUPON_NAME = 'Trial fee credit ($1 off first payment)'

// In-memory cache so we only look up / create once per cold start.
let cachedPriceId: string | null = null
let cachedCouponId: string | null = null

/**
 * Lazily resolve (or create) a one-time $1 Stripe Price used as the trial
 * activation fee. The price is tagged with metadata so we can find it again
 * after a redeploy without creating duplicates.
 */
export async function getTrialFeePrice(): Promise<string> {
  if (cachedPriceId) return cachedPriceId

  // Search for an existing price by metadata.
  const existing = await stripe.prices.search({
    query: `metadata["delta_trial_fee"]:"true" active:"true"`,
    limit: 1,
  })

  if (existing.data.length > 0) {
    cachedPriceId = existing.data[0].id
    return cachedPriceId
  }

  // Create product + price.
  const product = await stripe.products.create({
    name: TRIAL_FEE_PRODUCT_NAME,
    metadata: { delta_trial_fee: 'true' },
  })

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: TRIAL_FEE_CENTS,
    currency: TRIAL_FEE_CURRENCY,
    metadata: { delta_trial_fee: 'true' },
  })

  cachedPriceId = price.id
  return cachedPriceId
}

/**
 * Lazily resolve (or create) a $1-off coupon applied to the first
 * subscription invoice so the trial fee is credited back.
 */
export async function getTrialFeeCoupon(): Promise<string> {
  if (cachedCouponId) return cachedCouponId

  // List coupons and find ours by metadata.
  const coupons = await stripe.coupons.list({ limit: 100 })
  const match = coupons.data.find(
    (c) => c.metadata?.delta_trial_fee_credit === 'true' && c.valid
  )

  if (match) {
    cachedCouponId = match.id
    return cachedCouponId
  }

  const coupon = await stripe.coupons.create({
    amount_off: TRIAL_FEE_CENTS,
    currency: TRIAL_FEE_CURRENCY,
    duration: 'once',
    name: TRIAL_FEE_COUPON_NAME,
    metadata: { delta_trial_fee_credit: 'true' },
  })

  cachedCouponId = coupon.id
  return cachedCouponId
}

/**
 * Refund the $1 trial activation fee for a customer.
 * Called when a subscription is canceled during the trial period.
 */
export async function refundTrialFee(customerId: string): Promise<boolean> {
  try {
    // Find the $1 charge — it will be the most recent one-time payment.
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 10,
    })

    const trialFeeCharge = charges.data.find(
      (charge) =>
        charge.amount === TRIAL_FEE_CENTS &&
        charge.currency === TRIAL_FEE_CURRENCY &&
        charge.paid &&
        !charge.refunded
    )

    if (!trialFeeCharge) {
      console.log('[TRIAL_FEE] No refundable $1 trial fee charge found for customer', customerId)
      return false
    }

    await stripe.refunds.create({
      charge: trialFeeCharge.id,
      reason: 'requested_by_customer',
      metadata: { reason: 'trial_cancellation_refund' },
    })

    console.log('[TRIAL_FEE] Refunded $1 trial fee for customer', customerId)
    return true
  } catch (error) {
    console.error('[TRIAL_FEE] Failed to refund trial fee:', error)
    return false
  }
}
