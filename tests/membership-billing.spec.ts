import assert from 'node:assert/strict'
import { getMembershipStatusFromMetadata } from '../lib/utils/membership'

const futureIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const trialMembership = getMembershipStatusFromMetadata({
  membership_tier: 'sharp',
  membership_status: 'trialing',
  stripe_current_period_end: futureIso,
  has_used_trial: true,
  has_paid: true,
})

assert.equal(trialMembership.isTrial, true)
assert.equal(trialMembership.hasPaidAccess, true)
assert.equal(trialMembership.isPayingCustomer, false)
assert.equal(trialMembership.hasSuccessfulPayment, false)

const canceledTrialMembership = getMembershipStatusFromMetadata({
  membership_tier: 'sharp',
  membership_status: 'canceled',
  stripe_current_period_end: futureIso,
  has_used_trial: true,
})

assert.equal(canceledTrialMembership.isActive, true)
assert.equal(canceledTrialMembership.hasPaidAccess, true)
assert.equal(canceledTrialMembership.isPayingCustomer, false)

const payingMembership = getMembershipStatusFromMetadata({
  membership_tier: 'syndicate',
  membership_status: 'active',
  stripe_current_period_end: futureIso,
  has_successful_payment: true,
})

assert.equal(payingMembership.isTrial, false)
assert.equal(payingMembership.isPayingCustomer, true)
assert.equal(payingMembership.hasSuccessfulPayment, true)
