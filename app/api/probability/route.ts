import { NextRequest, NextResponse } from 'next/server'
import {
  calculateBetProbability,
  calculateSpreadProbability,
  calculateTotalProbability,
  calculateMoneylineProbability,
  calculatePlayerPropProbability,
  type BetProbabilityInput
} from '@/lib/services/probability-engine'
import {
  calculateExpectedValue,
  kellyBetSize,
  oddsToImpliedProbability
} from '@/lib/utils/statistics'

/**
 * POST /api/probability
 * Calculate win probability for a bet
 *
 * Body should match BetProbabilityInput interface
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as BetProbabilityInput

    // Validate required fields
    if (!body.betType || !body.sport) {
      return NextResponse.json(
        { error: 'Missing required fields: betType and sport' },
        { status: 400 }
      )
    }

    // Calculate probability
    const result = await calculateBetProbability(body)

    // Calculate additional metrics if odds are provided
    let additionalMetrics: any = {}

    if (body.odds) {
      const impliedProbability = oddsToImpliedProbability(body.odds)
      const expectedValue = calculateExpectedValue(result.probability, body.odds, 100)
      const edge = ((result.probability - impliedProbability) / impliedProbability) * 100

      additionalMetrics = {
        impliedProbability: impliedProbability,
        calculatedProbability: result.probability,
        edge: edge,
        expectedValue: expectedValue,
        recommendation: edge > 5 ? 'Positive edge - consider betting' :
                        edge < -5 ? 'Negative edge - avoid' :
                        'Neutral - no significant edge',
        kellyBetSize: edge > 0 ? kellyBetSize(result.probability, body.odds, 1000) : 0
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      ...additionalMetrics,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Probability] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate probability', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/probability
 * Get example probability calculations or calculate simple scenarios
 *
 * Query parameters:
 *   - type: 'spread', 'total', 'moneyline', or 'prop'
 *   - sport: Sport key (e.g., 'basketball_nba')
 *   - ... other parameters depending on type
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const sport = searchParams.get('sport') || 'basketball_nba'

    if (!type) {
      // Return documentation
      return NextResponse.json({
        message: 'Probability Engine API',
        endpoints: {
          POST: {
            description: 'Calculate bet probability',
            body: {
              betType: "'spread' | 'total' | 'moneyline' | 'prop'",
              sport: 'Sport identifier (e.g., basketball_nba)',
              currentScore: '{ away: number, home: number }',
              timeRemaining: 'Time remaining in seconds',
              spread: 'Spread value (for spread bets)',
              totalLine: 'Total line (for total/prop bets)',
              direction: "'over' | 'under' (for total/prop bets)",
              odds: 'American odds (optional)',
              playerCurrentStat: 'Current stat value (for props)',
              playerMinutesPlayed: 'Minutes played (for props)',
              playerProjectedMinutes: 'Projected minutes (for props)',
              playerSeasonAverage: 'Season average (for props)'
            }
          },
          GET: {
            description: 'Get example or simple calculation',
            params: {
              type: 'Bet type',
              sport: 'Sport identifier',
              '...': 'Additional params based on type'
            }
          }
        },
        examples: {
          spread: '/api/probability?type=spread&sport=basketball_nba&margin=5&spread=-7&timeRemaining=600',
          total: '/api/probability?type=total&sport=basketball_nba&currentTotal=180&line=215.5&direction=over&timeRemaining=1200&timeElapsed=1680',
          moneyline: '/api/probability?type=moneyline&sport=basketball_nba&margin=8&timeRemaining=300',
          prop: '/api/probability?type=prop&currentStat=22&line=28.5&direction=over&minutesPlayed=28&projectedMinutes=35&seasonAvg=25'
        }
      })
    }

    let probability = 0.5
    let calculation = 'Default'

    // Simple calculations based on query params
    if (type === 'spread') {
      const margin = parseFloat(searchParams.get('margin') || '0')
      const spread = parseFloat(searchParams.get('spread') || '0')
      const timeRemaining = parseFloat(searchParams.get('timeRemaining') || '600')

      probability = calculateSpreadProbability(margin, spread, timeRemaining, sport, 100)
      calculation = `Spread: margin=${margin}, spread=${spread}, timeRemaining=${timeRemaining}s`
    } else if (type === 'total') {
      const currentTotal = parseFloat(searchParams.get('currentTotal') || '100')
      const line = parseFloat(searchParams.get('line') || '200')
      const direction = (searchParams.get('direction') || 'over') as 'over' | 'under'
      const timeRemaining = parseFloat(searchParams.get('timeRemaining') || '1200')
      const timeElapsed = parseFloat(searchParams.get('timeElapsed') || '1680')

      probability = calculateTotalProbability(currentTotal, line, direction, timeRemaining, sport, timeElapsed)
      calculation = `Total: current=${currentTotal}, line=${line}, direction=${direction}, timeRemaining=${timeRemaining}s`
    } else if (type === 'moneyline') {
      const margin = parseFloat(searchParams.get('margin') || '0')
      const timeRemaining = parseFloat(searchParams.get('timeRemaining') || '600')

      probability = calculateMoneylineProbability(margin, timeRemaining, sport)
      calculation = `Moneyline: margin=${margin}, timeRemaining=${timeRemaining}s`
    } else if (type === 'prop') {
      const currentStat = parseFloat(searchParams.get('currentStat') || '15')
      const line = parseFloat(searchParams.get('line') || '20')
      const direction = (searchParams.get('direction') || 'over') as 'over' | 'under'
      const minutesPlayed = parseFloat(searchParams.get('minutesPlayed') || '20')
      const projectedMinutes = parseFloat(searchParams.get('projectedMinutes') || '32')
      const seasonAvg = parseFloat(searchParams.get('seasonAvg') || '18')

      probability = calculatePlayerPropProbability(
        currentStat,
        line,
        direction,
        minutesPlayed,
        projectedMinutes,
        seasonAvg
      )
      calculation = `Prop: current=${currentStat}, line=${line}, direction=${direction}, minutes=${minutesPlayed}/${projectedMinutes}`
    }

    return NextResponse.json({
      success: true,
      type,
      sport,
      probability,
      probabilityPercent: (probability * 100).toFixed(1) + '%',
      calculation,
      confidence: probability > 0.8 || probability < 0.2 ? 'high' :
                  probability > 0.6 || probability < 0.4 ? 'medium' : 'low'
    })
  } catch (error: any) {
    console.error('[Probability] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate probability', details: error.message },
      { status: 500 }
    )
  }
}
