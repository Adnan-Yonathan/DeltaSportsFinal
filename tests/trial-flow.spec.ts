import assert from 'node:assert/strict'
import {
  buildTrialOnboardingProfile,
  calculateRoiSnapshot,
  getExperienceResponse,
  prioritizeTools,
  shouldStartPrecheckoutOnboarding,
} from '../lib/trial-flow'
import type { MembershipInfo } from '../lib/utils/membership'

const buildMembership = (overrides: Partial<MembershipInfo>): MembershipInfo => ({
  tier: null,
  status: null,
  isActive: false,
  isTrial: false,
  isPayingCustomer: false,
  hasUsedTrial: false,
  hasSuccessfulPayment: false,
  hasPaidAccess: false,
  hasProjectionAccess: false,
  hasResearchAccess: false,
  hasFullAccess: false,
  currentPeriodEnd: null,
  cancelAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  planVersion: 2,
  ...overrides,
})

const roi = calculateRoiSnapshot(200, 2)
assert.equal(roi.monthly_ev, 314.4)
assert.equal(roi.yearly_ev, 3772.8)
assert.equal(roi.roi_vs_plan_cost, 3.98)

const whalePriority = prioritizeTools(['track-whale-activity'], 'recreational')
assert.equal(whalePriority[0], 'whale-detector')

const validationPriority = prioritizeTools(['validate-picks'], 'sharp-pro')
assert.equal(validationPriority[0], 'research-mode')

assert.match(
  getExperienceResponse('serious-bettor'),
  /edge-ranked projections/i,
  'Serious bettors should be told Delta leads with edge-ranked projections'
)

const profile = buildTrialOnboardingProfile({
  name: 'Alex',
  experienceLevel: 'sharp-pro',
  goals: ['validate-picks', 'find-sharp-lines'],
  betSize: 200,
  betsPerDay: 2,
})

assert.equal(profile.name, 'Alex')
assert.deepEqual(profile.goal_keys, ['validate-picks', 'find-sharp-lines'])
assert.equal(profile.prioritized_tools[0], 'research-mode')
assert.equal(profile.roi_snapshot.monthly_ev, 314.4)

assert.equal(
  shouldStartPrecheckoutOnboarding(
    buildMembership({}),
    {}
  ),
  true
)

assert.equal(
  shouldStartPrecheckoutOnboarding(
    buildMembership({
      tier: 'syndicate',
      status: 'trialing',
      isActive: true,
      isTrial: true,
      hasPaidAccess: true,
      hasProjectionAccess: true,
      hasResearchAccess: true,
      hasFullAccess: true,
      hasUsedTrial: true,
    }),
    { precheckout_onboarding_completed: true }
  ),
  false
)

console.log('trial-flow tests passed')
