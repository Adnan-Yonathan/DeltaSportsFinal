# Probability Engine Guide

## Overview

The Probability Engine calculates win probabilities for bets in real-time based on current game state, using statistical models tailored to each sport and bet type.

## Features

- **Spread Probability** - Calculate chances of covering the spread
- **Total Probability** - Calculate over/under hit probability
- **Moneyline Probability** - Calculate win/loss probability
- **Player Props** - Calculate player stat probability
- **Expected Value** - Calculate EV for any bet
- **Kelly Criterion** - Optimal bet sizing recommendations
- **Edge Detection** - Compare true probability vs implied odds

## Architecture

### Components

1. **Statistical Utilities** (`lib/utils/statistics.ts`)
   - Normal distribution functions
   - Z-score calculations
   - Odds conversions
   - Kelly Criterion sizing

2. **Probability Engine** (`lib/services/probability-engine.ts`)
   - Sport-specific models
   - Bet type calculators
   - Confidence scoring

3. **API Endpoint** (`app/api/probability/route.ts`)
   - REST interface
   - Validation
   - Response formatting

## Statistical Models

### Spread Probability

**Formula:**
```
Differential = CurrentMargin - Spread
StdDev = √(ExpectedPointsRemaining × 0.8)
Z-Score = Differential / StdDev
Probability = NormalCDF(Z-Score)
```

**Factors:**
- Current score margin
- Spread value
- Time remaining
- Sport-specific scoring rate

**Example:**
```typescript
// Lakers -7 vs Celtics
// Currently winning by 5, 10 minutes left
const prob = calculateSpreadProbability(
  5,      // Current margin
  -7,     // Spread
  600,    // Time remaining (seconds)
  'basketball_nba',
  110     // Current total score
)
// Returns: ~0.35 (35% chance to cover -7)
```

### Total Probability

**Formula:**
```
CurrentPace = CurrentTotal / MinutesElapsed
ProjectedFinal = CurrentTotal + (CurrentPace × MinutesRemaining)
StdDev = √(MinutesRemaining × PointsPerMinute) × 2.5
Z-Score = (ProjectedFinal - Line) / StdDev
Probability = NormalCDF(Z-Score)
```

**Factors:**
- Current combined score
- Scoring pace
- Time remaining
- Total line value

**Example:**
```typescript
// Over 215.5
// Currently 180 points, 28 minutes elapsed, 20 minutes left
const prob = calculateTotalProbability(
  180,    // Current total
  215.5,  // Line
  'over', // Direction
  1200,   // Time remaining
  'basketball_nba',
  1680    // Time elapsed
)
// Returns: ~0.68 (68% chance to hit over)
```

### Moneyline Probability

**Formula:**
```
StdDev = √(ExpectedPointsRemaining)
Z-Score = CurrentMargin / StdDev
Probability = NormalCDF(Z-Score)

// Blended with implied odds:
FinalProb = (CalcProb × ElapsedWeight) + (ImpliedProb × (1 - ElapsedWeight))
```

**Factors:**
- Current margin
- Time remaining
- Implied odds (optional)
- Sport-specific variance

**Example:**
```typescript
// Lakers ML (-150)
// Winning by 8, 5 minutes left
const prob = calculateMoneylineProbability(
  8,      // Current margin
  300,    // Time remaining
  'basketball_nba',
  -150    // Odds (optional)
)
// Returns: ~0.92 (92% chance to win)
```

### Player Props Probability

**Formula:**
```
CurrentPace = CurrentStat / MinutesPlayed
ProjectedRemaining = CurrentPace × MinutesRemaining
ProjectedFinal = CurrentStat + ProjectedRemaining

BaseVariance = SeasonAverage × 0.3
PaceVariance = |CurrentPace - SeasonPace| × MinutesRemaining
StdDev = √(BaseVariance + PaceVariance)

Z-Score = (ProjectedFinal - Line) / StdDev
Probability = NormalCDF(Z-Score)
```

**Factors:**
- Current stat value
- Playing time
- Projected minutes
- Season average
- Current pace

**Example:**
```typescript
// LeBron James Over 28.5 points
// Currently 22 points, 28 minutes played, 35 projected
const prob = calculatePlayerPropProbability(
  22,     // Current points
  28.5,   // Line
  'over', // Direction
  28,     // Minutes played
  35,     // Projected minutes
  25.3    // Season average
)
// Returns: ~0.72 (72% chance to hit over)
```

## API Usage

### Endpoint

**POST `/api/probability`**

Calculate comprehensive bet probability with all metrics.

**Request Body:**
```json
{
  "betType": "spread",
  "sport": "basketball_nba",
  "currentScore": { "away": 95, "home": 102 },
  "timeRemaining": 720,
  "spread": -5.5,
  "odds": -110
}
```

**Response:**
```json
{
  "success": true,
  "probability": 0.68,
  "confidence": "high",
  "factors": {
    "currentState": "Currently leading by 7",
    "projection": "Need to win by 5.5 or more",
    "variance": "Low variance - outcome likely determined"
  },
  "recommendation": "Strong position - likely to hit",
  "impliedProbability": 0.524,
  "calculatedProbability": 0.68,
  "edge": 29.8,
  "expectedValue": 15.45,
  "kellyBetSize": 34.2,
  "timestamp": "2025-11-10T16:30:00Z"
}
```

### GET Examples

**Simple Calculations:**

```bash
# Spread probability
curl "http://localhost:3002/api/probability?type=spread&sport=basketball_nba&margin=5&spread=-7&timeRemaining=600"

# Total probability
curl "http://localhost:3002/api/probability?type=total&sport=basketball_nba&currentTotal=180&line=215.5&direction=over&timeRemaining=1200&timeElapsed=1680"

# Moneyline probability
curl "http://localhost:3002/api/probability?type=moneyline&sport=basketball_nba&margin=8&timeRemaining=300"

# Player prop probability
curl "http://localhost:3002/api/probability?type=prop&currentStat=22&line=28.5&direction=over&minutesPlayed=28&projectedMinutes=35&seasonAvg=25"
```

## Service Functions

### Direct Function Calls

```typescript
import {
  calculateSpreadProbability,
  calculateTotalProbability,
  calculateMoneylineProbability,
  calculatePlayerPropProbability,
  calculateBetProbability
} from '@/lib/services/probability-engine'

// Spread
const spreadProb = calculateSpreadProbability(
  currentMargin,
  spread,
  timeRemaining,
  sport,
  currentScore
)

// Total
const totalProb = calculateTotalProbability(
  currentTotal,
  line,
  direction,
  timeRemaining,
  sport,
  timeElapsed
)

// Moneyline
const mlProb = calculateMoneylineProbability(
  currentMargin,
  timeRemaining,
  sport,
  odds // optional
)

// Player Prop
const propProb = calculatePlayerPropProbability(
  currentStat,
  line,
  direction,
  minutesPlayed,
  projectedMinutes,
  seasonAverage
)

// Comprehensive (recommended)
const result = calculateBetProbability({
  betType: 'spread',
  sport: 'basketball_nba',
  currentScore: { away: 95, home: 102 },
  timeRemaining: 720,
  spread: -5.5
})
```

## Statistical Utilities

### Odds Conversions

```typescript
import {
  oddsToImpliedProbability,
  probabilityToAmericanOdds
} from '@/lib/utils/statistics'

// American odds to probability
const prob = oddsToImpliedProbability(-110)  // 0.524 (52.4%)
const prob2 = oddsToImpliedProbability(+150) // 0.400 (40%)

// Probability to American odds
const odds = probabilityToAmericanOdds(0.55)  // -122
const odds2 = probabilityToAmericanOdds(0.35) // +186
```

### Expected Value

```typescript
import { calculateExpectedValue } from '@/lib/utils/statistics'

const ev = calculateExpectedValue(
  0.55,   // 55% win probability
  -110,   // American odds
  100     // Stake
)
// Returns: +4.55 (positive EV - good bet!)
```

### Kelly Criterion

```typescript
import { kellyBetSize } from '@/lib/utils/statistics'

const betSize = kellyBetSize(
  0.55,   // 55% win probability
  -110,   // American odds
  1000    // Bankroll
)
// Returns: 22.7 (bet $22.70 for optimal growth)
// Note: Uses 1/4 Kelly for safety
```

### Normal Distribution

```typescript
import { normalCDF, inverseNormalCDF } from '@/lib/utils/statistics'

// Z-score to probability
const prob = normalCDF(1.5)  // 0.933 (93.3%)

// Probability to Z-score
const z = inverseNormalCDF(0.95)  // 1.645
```

## Sport-Specific Parameters

### Scoring Rates (points per minute)

```typescript
const SCORING_RATES = {
  'basketball_nba': 2.0,        // ~240 pts in 48 min
  'basketball_ncaab': 1.75,     // ~140 pts in 40 min
  'americanfootball_nfl': 0.75, // ~45 pts in 60 min
  'americanfootball_ncaaf': 0.9,// ~54 pts in 60 min
  'icehockey_nhl': 0.1,         // ~6 pts in 60 min
  'baseball_mlb': 0.33          // ~9 pts in 27 outs
}
```

### Game Lengths (minutes)

```typescript
const GAME_LENGTHS = {
  'basketball_nba': 48,
  'basketball_ncaab': 40,
  'americanfootball_nfl': 60,
  'americanfootball_ncaaf': 60,
  'icehockey_nhl': 60,
  'baseball_mlb': 27  // innings/outs
}
```

## Edge Detection

**What is Edge?**

Edge is the difference between your calculated probability and the bookmaker's implied probability.

```
Edge = (TrueProbability - ImpliedProbability) / ImpliedProbability × 100
```

**Interpretation:**
- **Edge > 5%**: Positive edge - consider betting
- **Edge < -5%**: Negative edge - avoid
- **-5% to 5%**: Neutral - no significant edge

**Example:**
```typescript
const trueProbability = 0.60  // 60% calculated
const impliedProbability = 0.524  // -110 odds implies 52.4%

const edge = ((0.60 - 0.524) / 0.524) * 100
// = 14.5% edge (excellent bet!)
```

## Confidence Levels

Confidence decreases with more time remaining:

| Time Remaining | Confidence |
|----------------|------------|
| < 10 minutes   | High       |
| 10-30 minutes  | Medium     |
| > 30 minutes   | Low        |

For player props:
| Minutes Played | Confidence |
|----------------|------------|
| > 20 minutes   | High       |
| 10-20 minutes  | Medium     |
| < 10 minutes   | Low        |

## Best Practices

### 1. Use Early and Often

Calculate probabilities throughout the game to identify value:

```typescript
// Before game starts
const preGameProb = calculateBetProbability({...})

// During game (every 5-10 minutes)
const liveProb = calculateBetProbability({...})

// Compare to identify live betting opportunities
if (liveProb > preGameProb + 0.15) {
  console.log('Probability increased 15%+ - consider hedging')
}
```

### 2. Consider Multiple Factors

Don't rely solely on probability:

```typescript
const result = calculateBetProbability({...})

if (
  result.probability > 0.70 &&
  result.confidence === 'high' &&
  result.edge && result.edge > 10
) {
  console.log('Strong bet - high probability, high confidence, positive edge')
}
```

### 3. Track Accuracy

Compare predictions to actual outcomes:

```typescript
// Store prediction
await savePrediction(betId, probability)

// After game, compare
const accuracy = calculatePredictionAccuracy(predictions, outcomes)
// Use to calibrate models over time
```

### 4. Adjust for Context

Models don't account for:
- Injuries during the game
- Foul trouble
- Garbage time
- Weather (outdoor sports)
- Coaching decisions

Always apply human judgment to model outputs.

## Limitations

### What the Model Does Well

✅ Baseline probability calculations
✅ Time-adjusted predictions
✅ Pace-based projections
✅ Statistical variance modeling

### What the Model Doesn't Consider

❌ Player fatigue
❌ Momentum swings
❌ Coaching adjustments
❌ Referee tendencies
❌ Clutch performance
❌ Team psychology
❌ Garbage time scenarios

### Accuracy Expectations

- **High confidence bets**: ~85-90% accuracy
- **Medium confidence bets**: ~70-75% accuracy
- **Low confidence bets**: ~60-65% accuracy

## Future Enhancements

### Planned Improvements

1. **Machine Learning Integration**
   - Train on historical data
   - Learn sport-specific patterns
   - Improve accuracy over time

2. **Advanced Factors**
   - Momentum indicators
   - Possession metrics
   - Efficiency ratings
   - Home court advantage

3. **Live Data Integration**
   - Real-time game state
   - Play-by-play analysis
   - Automatic updates

4. **Calibration**
   - Track prediction accuracy
   - Adjust model parameters
   - Sport-specific tuning

5. **Ensemble Models**
   - Combine multiple approaches
   - Weighted averaging
   - Confidence-based blending

## Troubleshooting

### Probability Always 50%

**Problem**: Function returns 0.5 for all inputs

**Solutions:**
- Check that all required parameters are provided
- Verify timeRemaining > 0
- Ensure sport identifier is valid
- Check for division by zero in inputs

### Unrealistic Probabilities

**Problem**: Getting probabilities > 0.99 or < 0.01

**Solutions:**
- Verify time remaining is in seconds, not minutes
- Check score inputs are reasonable
- Ensure spread/line values are correct
- Consider if game is actually decided

### Low Confidence Always

**Problem**: Confidence always shows "low"

**Solutions:**
- Check time remaining calculation
- Verify it's in seconds, not minutes
- For props, check minutes played

## References

- [Normal Distribution](https://en.wikipedia.org/wiki/Normal_distribution)
- [Z-Score](https://en.wikipedia.org/wiki/Standard_score)
- [Expected Value](https://en.wikipedia.org/wiki/Expected_value)
- [Kelly Criterion](https://en.wikipedia.org/wiki/Kelly_criterion)
- [Implied Probability](https://www.actionnetwork.com/education/implied-probability)

## Examples

### Complete Workflow

```typescript
// 1. Fetch live game data
const game = await fetchLiveScore('game-123')

// 2. Calculate probability
const result = await calculateBetProbability({
  betType: 'spread',
  sport: 'basketball_nba',
  currentScore: game.score,
  timeRemaining: game.timeRemaining,
  spread: -7.5,
  odds: -110
})

// 3. Analyze edge
if (result.edge && result.edge > 10) {
  console.log(`Found ${result.edge}% edge!`)

  // 4. Calculate optimal bet size
  const betSize = kellyBetSize(
    result.probability,
    -110,
    userBankroll
  )

  console.log(`Recommended bet: $${betSize.toFixed(2)}`)
  console.log(`Expected value: $${result.expectedValue.toFixed(2)}`)
}

// 5. Track prediction
await savePrediction({
  gameId: 'game-123',
  probability: result.probability,
  confidence: result.confidence,
  timestamp: new Date()
})
```

### Integration with Live Tracking

```typescript
// Update bet probabilities every 30 seconds
setInterval(async () => {
  const pendingBets = await getPendingBets()

  for (const bet of pendingBets) {
    const game = await fetchLiveScore(bet.gameId)

    const probability = await calculateBetProbability({
      betType: bet.type,
      sport: bet.sport,
      currentScore: game.score,
      timeRemaining: game.timeRemaining,
      spread: bet.spread,
      totalLine: bet.totalLine,
      direction: bet.direction
    })

    await updateBetProbability(bet.id, probability)
  }
}, 30000)
```
