# Plan: Bankroll & Expected Profit Onboarding Steps

## Active Kan Item: Sharp Money Feed

- Status: In progress
- Scope: Canonical `/sharp-money-feed` tool + `/tools/sharp-money-feed` guide, with legacy redirects.
- Data: Polymarket only, strict sports + esports allowlist, sport-specific ROI/risk scoring.
- UX: Left-nav safe label, Polymarket logo deep link per trade card, Syndicate-gated sharp money view.

## Overview

Add two new onboarding steps to show users their expected monthly profit based on their bankroll before presenting pricing. This creates value perception by showing potential returns.

## User Flow

**Current flow:**
1. Features (why signing up)
2. Sports
3. Markets
4. Experience
5. Risk Tolerance
6. Pricing

**New flow:**
1. Features (why signing up)
2. Sports
3. Markets
4. Experience
5. Risk Tolerance
6. **Bankroll (NEW)** - Ask for starting bankroll
7. **Expected Profit (NEW)** - Show calculated monthly profit
8. Pricing

## Calculation Logic

### Assumptions
- **Unit size**: 2% of bankroll (industry standard conservative sizing)
- **Win rate**: 55% at -110 odds
- **Edge per bet**: 2.62%
- **Monthly bets**: ~30 bets/month (configurable, show slider)

### Formula
```
unit_size = bankroll * 0.02
expected_profit_per_bet = unit_size * 0.0262
monthly_profit = expected_profit_per_bet * bets_per_month
```

### Example ($10,000 bankroll)
- Unit size: $10,000 * 0.02 = **$200**
- Profit per bet: $200 * 0.0262 = **$5.24**
- Monthly profit (30 bets): $5.24 * 30 = **$157.20**
- Yearly profit: $157.20 * 12 = **$1,886.40**

## Files to Create/Modify

### 1. Simplify StepBankroll
**File**: `components/onboarding/StepBankroll.tsx`

Current version asks for bankroll AND unit size. Simplify to ONLY ask for bankroll:
- Single input field for bankroll
- Show "We recommend 2% per bet" note
- Clean, minimal design matching other steps
- Preset quick-select buttons: $500, $1,000, $5,000, $10,000, $25,000

```typescript
interface StepBankrollProps {
  value: number
  onChange: (value: number) => void
  onValidation: (isValid: boolean) => void
}
```

### 2. Create StepExpectedProfit
**File**: `components/onboarding/StepExpectedProfit.tsx`

New component showing calculated expected profit:

**UI Design:**
- Big animated headline: "Your Expected Monthly Profit"
- Large animated number showing monthly profit (e.g., "$157")
- Breakdown card showing:
  - Your bankroll: $10,000
  - Unit size (2%): $200/bet
  - Our edge: 2.62% per bet
  - Bets per month: 30 (with slider to adjust)
- Yearly projection: "$1,886/year"
- Disclaimer: "Based on historical Sharp Projections performance"

```typescript
interface StepExpectedProfitProps {
  bankroll: number
  onValidation: (isValid: boolean) => void
}

// Calculation helper
function calculateExpectedProfit(bankroll: number, betsPerMonth: number = 30) {
  const EDGE_PER_BET = 0.0262 // 2.62%
  const UNIT_PERCENT = 0.02   // 2% of bankroll

  const unitSize = bankroll * UNIT_PERCENT
  const profitPerBet = unitSize * EDGE_PER_BET
  const monthlyProfit = profitPerBet * betsPerMonth
  const yearlyProfit = monthlyProfit * 12

  return {
    unitSize,
    profitPerBet,
    monthlyProfit,
    yearlyProfit,
    betsPerMonth,
  }
}
```

### 3. Update OnboardingFlow
**File**: `components/OnboardingFlow.tsx`

Changes:
1. Add `bankroll` to `OnboardingData` interface
2. Import new components
3. Update `totalSteps` from 6 to 8
4. Insert bankroll step after risk tolerance (index 5)
5. Insert expected profit step after bankroll (index 6)
6. Keep pricing as final step (index 7)

```typescript
interface OnboardingData {
  favorite_sports: string[]
  preferred_markets: string[]
  experience_level: string
  risk_tolerance: string
  signup_reasons: string[]
  bankroll: number          // NEW
  pricing_intent: string | null
}

const steps = [
  // ... existing steps 0-4
  { component: <StepRiskTolerance ... /> },    // index 4
  { component: <StepBankroll ... /> },          // index 5 (NEW)
  { component: <StepExpectedProfit ... /> },    // index 6 (NEW)
  { component: <StepPricing ... /> },           // index 7
]
```

### 4. Update API (if needed)
**File**: `app/api/onboarding/route.ts`

Add `bankroll` field to saved onboarding data (optional, for analytics).

## Component Details

### StepBankroll UI Structure

```
┌────────────────────────────────────────────┐
│                                            │
│            BANKROLL                        │
│   What's your starting bankroll?           │
│   The amount you're dedicating to betting  │
│                                            │
│   ┌────────────────────────────────────┐   │
│   │  $  |  10000                       │   │
│   └────────────────────────────────────┘   │
│                                            │
│   Quick select:                            │
│   [$500] [$1k] [$5k] [$10k] [$25k]        │
│                                            │
│   ┌────────────────────────────────────┐   │
│   │ We'll use 2% per bet ($200)        │   │
│   │ This is the safest way to grow     │   │
│   │ your bankroll long-term.           │   │
│   └────────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

### StepExpectedProfit UI Structure

```
┌────────────────────────────────────────────┐
│                                            │
│          YOUR PROJECTED PROFIT             │
│   Based on Sharp Projections' 55% edge     │
│                                            │
│              ┌────────┐                    │
│              │ $157   │ /month             │
│              └────────┘                    │
│                                            │
│   ─────────────────────────────────────    │
│                                            │
│   Bankroll         $10,000                 │
│   Unit size (2%)   $200/bet                │
│   Our edge         2.62%                   │
│   ─────────────────────────────────────    │
│   Bets per month   [===========○===] 30    │
│   ─────────────────────────────────────    │
│   Yearly profit    $1,886                  │
│                                            │
│   ┌────────────────────────────────────┐   │
│   │ This is your expected long-run     │   │
│   │ profit based on our 55% win rate   │   │
│   │ on Sharp Projections.              │   │
│   └────────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

## Implementation Order

1. **StepBankroll.tsx** - Simplify existing component (remove unit size input, add presets)
2. **StepExpectedProfit.tsx** - Create new component with calculations and animations
3. **OnboardingFlow.tsx** - Add bankroll to state, update steps array, update totalSteps
4. **Testing** - Verify flow, calculations, and animations

## Animation Notes

For StepExpectedProfit, use counting animation for the big profit number:
- Start from $0, count up to final amount over ~1.5 seconds
- Use framer-motion for smooth entrance
- Subtle pulse/glow on the final number

## Edge Cases

1. **$0 bankroll**: Show validation error, require positive number
2. **Very small bankroll (<$100)**: Still show calculation, may show cents
3. **Very large bankroll (>$1M)**: Format with K/M abbreviations
4. **Skip button**: Allow users to skip bankroll step (set default or mark as skipped)

## Copy/Messaging

**StepBankroll header:**
- Title: "What's your bankroll?"
- Subtitle: "The amount you're dedicating to sports betting"

**StepExpectedProfit header:**
- Title: "Your Projected Monthly Profit"
- Subtitle: "Based on Sharp Projections' historical 55% win rate"

**Disclaimer (small text):**
"Projections based on historical Sharp Projections performance. Past performance does not guarantee future results. Bet responsibly."

## Data Flow

```
StepBankroll
    │
    ├── User enters bankroll (e.g., $10,000)
    │
    ▼
OnboardingFlow
    │
    ├── Stores bankroll in data.bankroll
    │
    ▼
StepExpectedProfit
    │
    ├── Reads bankroll from props
    ├── Calculates: $10,000 * 0.02 * 0.0262 * 30 = $157.20
    │
    ▼
Display animated results
```
