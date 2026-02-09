/**
 * Create new Stripe subscription Prices with a 7-day trial.
 *
 * Why this exists:
 * - Stripe subscription trials are typically configured per-subscription (Checkout Session)
 *   or baked into a subscription Price at creation time.
 * - Existing Prices are effectively immutable for recurring fields; you generally create
 *   a new Price and swap your app's STRIPE_PRICE_* env vars.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/stripe-migrate-trial-days.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/stripe-migrate-trial-days.ts --apply
 *
 * Notes:
 * - Dry-run by default (prints what it would do).
 * - Requires STRIPE_SECRET_KEY in .env.local.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import assert from 'node:assert/strict'
import Stripe from 'stripe'

type StripePriceEnv = {
  envKey: string
  planKey:
    | 'sharp_weekly'
    | 'sharp_monthly'
    | 'sharp_annual'
    | 'syndicate_weekly'
    | 'syndicate_monthly'
    | 'syndicate_annual'
}

const PRICE_ENV_KEYS: StripePriceEnv[] = [
  { envKey: 'STRIPE_PRICE_SHARP_WEEKLY', planKey: 'sharp_weekly' },
  { envKey: 'STRIPE_PRICE_SHARP_MONTHLY', planKey: 'sharp_monthly' },
  { envKey: 'STRIPE_PRICE_SHARP_ANNUAL', planKey: 'sharp_annual' },
  { envKey: 'STRIPE_PRICE_SYNDICATE_WEEKLY', planKey: 'syndicate_weekly' },
  { envKey: 'STRIPE_PRICE_SYNDICATE_MONTHLY', planKey: 'syndicate_monthly' },
  { envKey: 'STRIPE_PRICE_SYNDICATE_ANNUAL', planKey: 'syndicate_annual' },
]

const TARGET_TRIAL_DAYS = 7

const hasFlag = (flag: string) => process.argv.includes(flag)

const formatUsd = (amount: number, currency: string) => {
  if (currency.toLowerCase() !== 'usd') return `${amount} ${currency.toUpperCase()}`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

async function run() {
  const apply = hasFlag('--apply')
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  assert(stripeSecretKey, 'STRIPE_SECRET_KEY is required in .env.local')

  const stripe = new Stripe(stripeSecretKey)

  console.log(`Stripe trial migration (target: ${TARGET_TRIAL_DAYS} days)`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`)
  console.log('')

  const results: Array<{ envKey: string; oldPriceId: string; newPriceId?: string }> = []

  for (const { envKey, planKey } of PRICE_ENV_KEYS) {
    const priceId = process.env[envKey]
    if (!priceId) {
      console.log(`[SKIP] ${envKey} is not set.`)
      continue
    }

    const price = await stripe.prices.retrieve(priceId)

    if (!price.recurring) {
      console.log(`[SKIP] ${envKey}=${priceId} is not a recurring price.`)
      continue
    }

    const currentTrial = price.recurring.trial_period_days
    const interval = `${price.recurring.interval_count ?? 1} ${price.recurring.interval}`
    const unitAmount = price.unit_amount
    const currency = price.currency

    if (unitAmount == null) {
      console.log(`[SKIP] ${envKey}=${priceId} has no unit_amount (usage-based or tiered).`)
      continue
    }

    console.log(
      `[CHECK] ${planKey} (${envKey}) -> ${priceId} | ${formatUsd(unitAmount / 100, currency)}/${interval}`
    )
    console.log(`        current trial: ${currentTrial ?? 'none'}`)

    if (currentTrial === TARGET_TRIAL_DAYS) {
      console.log('        OK: already 3-day trial\n')
      results.push({ envKey, oldPriceId: priceId })
      continue
    }

    if (!apply) {
      console.log('        Would create a new price with a 3-day trial.\n')
      results.push({ envKey, oldPriceId: priceId })
      continue
    }

    const newPrice = await stripe.prices.create({
      product: typeof price.product === 'string' ? price.product : price.product.id,
      currency: price.currency,
      unit_amount: price.unit_amount,
      recurring: {
        interval: price.recurring.interval,
        interval_count: price.recurring.interval_count ?? undefined,
        trial_period_days: TARGET_TRIAL_DAYS,
      },
      nickname: price.nickname ? `${price.nickname} (3-day trial)` : undefined,
      tax_behavior: price.tax_behavior ?? undefined,
      metadata: {
        migrated_from_price: price.id,
        trial_days: String(TARGET_TRIAL_DAYS),
      },
    })

    console.log(`        CREATED: ${newPrice.id}`)
    console.log(`        Update env: ${envKey}=${newPrice.id}\n`)

    results.push({ envKey, oldPriceId: priceId, newPriceId: newPrice.id })
  }

  console.log('---')
  console.log('Summary')
  results.forEach((item) => {
    if (!item.newPriceId) return
    console.log(`${item.envKey} -> ${item.newPriceId} (was ${item.oldPriceId})`)
  })

  if (apply) {
    console.log('')
    console.log('Next steps:')
    console.log('- Update your hosting env vars (Vercel) for the STRIPE_PRICE_* keys above.')
    console.log('- Keep old prices active for existing subscriptions; they can remain in Stripe.')
  } else {
    console.log('')
    console.log('Run again with --apply to create the new prices.')
  }
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
