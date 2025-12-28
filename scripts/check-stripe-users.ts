/**
 * Check which users have Stripe customer IDs
 * Run with: npx ts-node scripts/check-stripe-users.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkStripeUsers() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  console.log(`\nTotal users: ${users.length}\n`)
  console.log('='.repeat(80))

  const withStripe: any[] = []
  const withoutStripe: any[] = []

  for (const user of users) {
    const meta = user.user_metadata || {}
    const stripeCustomerId = meta.stripe_customer_id
    const subscriptionId = meta.stripe_subscription_id
    const tier = meta.membership_tier
    const status = meta.membership_status

    if (stripeCustomerId) {
      withStripe.push({
        email: user.email,
        stripeCustomerId,
        subscriptionId,
        tier,
        status
      })
    } else {
      withoutStripe.push({
        email: user.email,
        tier,
        status
      })
    }
  }

  console.log('\n✅ USERS WITH STRIPE CUSTOMER ID:\n')
  if (withStripe.length === 0) {
    console.log('  (none)')
  } else {
    for (const u of withStripe) {
      console.log(`  ${u.email}`)
      console.log(`    Customer: ${u.stripeCustomerId}`)
      console.log(`    Subscription: ${u.subscriptionId || 'n/a'}`)
      console.log(`    Tier: ${u.tier || 'n/a'} | Status: ${u.status || 'n/a'}`)
      console.log('')
    }
  }

  console.log('\n❌ USERS WITHOUT STRIPE CUSTOMER ID:\n')
  if (withoutStripe.length === 0) {
    console.log('  (none)')
  } else {
    for (const u of withoutStripe) {
      console.log(`  ${u.email} (tier: ${u.tier || 'none'}, status: ${u.status || 'none'})`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`Summary: ${withStripe.length} with Stripe, ${withoutStripe.length} without`)
}

checkStripeUsers().catch(console.error)
