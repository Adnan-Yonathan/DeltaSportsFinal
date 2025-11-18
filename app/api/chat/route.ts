import { NextRequest, NextResponse } from 'next/server'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
import type { OddsGame } from '@/lib/types/odds'
import { enrichGamesWithStats, formatEnrichedGamesForAI } from '@/lib/stats-enrichment'
import { getTeamStats, getInjuryReports, formatStatsForAI } from '@/lib/sports-stats-api'
import { fetchESPNScores, fetchESPNScoresForDate } from '@/lib/espn-api'
import { fetchEventsIO } from '@/lib/api/odds-api'
import { listCustomModels, saveCustomModel, touchCustomModelUsage, CustomModelRow } from '@/lib/models/custom-models'
import { CustomModelStatInput } from '@/lib/models/custom-model-types'
import { runCustomModel } from '@/lib/models/model-runner'
import { buildGameContext } from '@/lib/context/game-context'
import { normalizePropMarketKey, normalizePropSelection, extractPropLine } from '@/lib/utils/props'
import { format } from 'date-fns'
import { openai, AI_MODELS } from '@/lib/ai-gateway-client'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes (max for Pro plan)

// Log model configuration on startup
console.log(`[CHAT] Using OpenAI API`)
console.log(`[CHAT] Chat Model: ${AI_MODELS.chat}`)
console.log(`[CHAT] Title Model: ${AI_MODELS.titleGen}`)

function resolveBaseUrl(req: NextRequest) {
  const origin = req?.nextUrl?.origin
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  if (origin) return origin
  if (envUrl) return envUrl

  const fallback = 'http://localhost:3000'
  console.warn('[CHAT] Falling back to default base URL; set NEXT_PUBLIC_APP_URL for accuracy')
  return fallback
}

// Helper function to create daily snapshot
async function createDailySnapshot(supabase: any, userId: string, balance: number) {
  const today = format(new Date(), 'yyyy-MM-dd')
  await supabase
    .from('bankroll_snapshots')
    .upsert(
      {
        user_id: userId,
        balance: balance,
        snapshot_date: today,
      },
      {
        onConflict: 'user_id,snapshot_date',
      }
    )
}

// Helper function to auto-generate conversation title
async function generateConversationTitle(userMessage: string, assistantResponse: string): Promise<string> {
  try {
    const titleModel = AI_MODELS.titleGen
    console.log(`[TITLE] Using model: ${titleModel}`)

    const completion = await openai.chat.completions.create({
      model: titleModel,
      messages: [
        {
          role: 'system',
          content:
            'Generate a short, descriptive title (3-5 words max) for this conversation. Focus on the main topic or action. Use buzzwords and be concise. Examples: "NBA Lakers vs Celtics", "Player Props Analysis", "Bankroll Strategy Tips", "NFL Week 10 Predictions".',
        },
        {
          role: 'user',
          content: `User: ${userMessage}\n\nAssistant: ${assistantResponse.substring(0, 500)}`,
        },
      ],
      max_tokens: 20,
      temperature: 0.7,
    })

    const text = completion.choices[0].message.content || ''
    console.log(`[TITLE] Response length: ${text.length}`)

    return text.trim() || 'New Chat'
  } catch (error) {
    console.error('Error generating title:', error)
    return 'New Chat'
  }
}

// Helper function to log a bet
async function logBet(supabase: any, userId: string, data: any, conversationId: string) {
  const {
    sport,
    league,
    game_description,
    bet_type,
    bet_side,
    odds,
    stake,
    book,
    notes,
    player_name,
    prop_market,
    prop_line,
    prop_selection,
    prop_team,
  } = data

  const normalizedPropMarket = normalizePropMarketKey(prop_market)
  const normalizedPropSelection = normalizePropSelection(prop_selection || bet_side)
  const normalizedPropLine =
    prop_line != null && prop_line !== ''
      ? parseFloat(prop_line)
      : extractPropLine(bet_side)

  // Calculate potential win based on American odds
  let potentialWin = 0
  if (odds > 0) {
    potentialWin = (stake * odds) / 100
  } else {
    potentialWin = (stake * 100) / Math.abs(odds)
  }

  // Insert bet
  const { data: bet, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      sport,
      league,
      game_description,
      bet_type,
      bet_side,
      odds: parseInt(odds),
      stake: parseFloat(stake),
      potential_win: potentialWin,
      book,
      notes: notes || null,
      status: 'pending',
      is_prop: Boolean(normalizedPropMarket && player_name),
      player_name: player_name || null,
      prop_market: normalizedPropMarket,
      prop_line: normalizedPropLine != null ? normalizedPropLine : null,
      prop_selection: normalizedPropSelection,
      prop_team: prop_team || null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: 'Failed to log bet', details: error.message }
  }

  return {
    success: true,
    bet,
    message: `Bet logged: $${stake} on ${game_description}`,
  }
}

// Helper function to log multiple bets at once
async function logMultipleBets(supabase: any, userId: string, bets: any[], conversationId: string) {
  const results = []
  let totalStake = 0

  // Calculate total stake
  for (const betData of bets) {
    totalStake += parseFloat(betData.stake)
  }

  // Process each bet
  for (const betData of bets) {
    const {
      sport,
      league,
      game_description,
      bet_type,
      bet_side,
      odds,
      stake,
      book,
      notes,
      player_name,
      prop_market,
      prop_line,
      prop_selection,
      prop_team,
    } = betData

    const normalizedPropMarket = normalizePropMarketKey(prop_market)
    const normalizedPropSelection = normalizePropSelection(prop_selection || bet_side)
    const normalizedPropLine =
      prop_line != null && prop_line !== ''
        ? parseFloat(prop_line)
        : extractPropLine(bet_side)

    // Calculate potential win based on American odds
    let potentialWin = 0
    if (odds > 0) {
      potentialWin = (stake * odds) / 100
    } else {
      potentialWin = (stake * 100) / Math.abs(odds)
    }

    // Insert bet
    const { data: bet, error } = await supabase
      .from('bets')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        sport,
        league,
        game_description,
        bet_type,
        bet_side,
        odds: parseInt(odds),
        stake: parseFloat(stake),
        potential_win: potentialWin,
        book,
        notes: notes || null,
        status: 'pending',
        is_prop: Boolean(normalizedPropMarket && player_name),
        player_name: player_name || null,
        prop_market: normalizedPropMarket,
        prop_line: normalizedPropLine != null ? normalizedPropLine : null,
        prop_selection: normalizedPropSelection,
        prop_team: prop_team || null,
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: `Failed to log bet for ${game_description}`,
        details: error.message,
      }
    }

    results.push({
      bet,
      description: `$${stake} on ${game_description}`,
    })
  }

  return {
    success: true,
    bets: results,
    totalStake,
    count: results.length,
    message: `Successfully logged ${results.length} bet(s) totaling $${totalStake.toFixed(2)}`,
  }
}

// Helper function to settle a bet
async function settleBet(supabase: any, userId: string, betId: string, result: string) {
  // Get the bet
  const { data: bet } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .eq('user_id', userId)
    .single()

  if (!bet) {
    return { success: false, error: 'Bet not found' }
  }

  if (bet.status !== 'pending') {
    return { success: false, error: 'Bet already settled' }
  }

  let actualResult = 0

  if (result === 'won') {
    // Store NET profit (potential_win only, not stake + potential_win)
    actualResult = parseFloat(bet.potential_win)
  } else if (result === 'push') {
    // Push = no profit or loss
    actualResult = 0
  } else if (result === 'lost') {
    // Store loss as negative value
    actualResult = -parseFloat(bet.stake)
  }

  // Update bet
  await supabase
    .from('bets')
    .update({
      status: result,
      actual_result: actualResult,
      settled_at: new Date().toISOString(),
    })
    .eq('id', betId)

  return {
    success: true,
    result: actualResult,
    message: `Bet settled as ${result}: ${actualResult >= 0 ? '+' : ''}$${actualResult.toFixed(2)}`,
  }
}

// Helper function to adjust bankroll
async function adjustBankroll(supabase: any, userId: string, amount: number, type: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  let newBankroll = parseFloat(userData.current_bankroll)

  if (type === 'deposit') {
    newBankroll += parseFloat(amount.toString())
  } else if (type === 'withdrawal') {
    newBankroll -= parseFloat(amount.toString())
  }

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  return {
    success: true,
    newBankroll,
    message: `${type === 'deposit' ? 'Deposited' : 'Withdrew'} $${amount}`,
  }
}

function normalizeStatArg(stat: any): CustomModelStatInput {
  if (!stat) {
    throw new Error('Invalid stat configuration provided')
  }

  const statKey = stat.stat_key || stat.statKey
  const label = stat.label
  const scope = stat.scope || 'team'
  const importance = stat.importance ?? stat.weight ?? 3
  const direction = stat.direction || 'higher_better'

  if (!statKey || !label) {
    throw new Error('Each stat requires stat_key and label fields')
  }

  return {
    statKey,
    label,
    scope,
    importance,
    direction,
    normalization: stat.normalization || 'zscore',
    sampleSource: stat.sample_source || stat.sampleSource,
    varianceOverride: stat.variance_override ?? stat.varianceOverride,
    minValue: stat.min_value ?? stat.minValue,
    maxValue: stat.max_value ?? stat.maxValue,
    notes: stat.notes,
  }
}

function buildStatInputs(rawStats: any): CustomModelStatInput[] {
  if (!Array.isArray(rawStats) || rawStats.length === 0) {
    throw new Error('At least one stat definition is required to create a model')
  }

  return rawStats.map(normalizeStatArg)
}

const getSystemPrompt = (timezone: string) => `You are DELTA, a professional sports betting assistant. Your role is to help users analyze betting opportunities, manage their bankroll, and understand sports betting markets.

**CURRENT DATE & TIME (${timezone}):**
Today's date is ${new Date().toLocaleDateString('en-US', {
  timeZone: timezone,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.
Current time is ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}.

  **IMPORTANT - YOU HAVE ACCESS TO ODDS DATA AND ADVANCED STATISTICS:**
You have REAL-TIME access to:
  1. Live odds data for NBA, NCAA Basketball (NCAAB), NFL, NCAA Football (NCAAF), MLB, and NHL via Odds-API.io (provider)
2. Team statistics (records, rankings, offensive/defensive stats)
3. Player statistics and performance metrics
4. Injury reports and lineup information
5. Advanced analytics (efficiency ratings, pace, trends)
6. **Player prop betting lines** - When users ask about player props, use the get_player_props function to fetch lines and odds
- IMPORTANT: If the user mentions specific teams (e.g., "Lakers props", "Chiefs player props"), pass those team names to the team parameter for efficient filtering
- Always present player props in a standardized markdown table with columns for Market, Line, Best Over, and Best Under. No bullet lists.

When users ask about odds, games, or arbitrage, the live data WILL BE PROVIDED in your context enriched with relevant stats. For player prop requests, use the get_player_props function.

**CRITICAL**: If you see "LIVE ODDS DATA" in your context below, you MUST use it. NEVER say you don't have access when data is provided. If NO odds data appears below, then you can say you don't currently have that specific data loaded.

**CRITICAL - Game Schedule Queries:**
When users ask "what games are today/tonight/tomorrow":
1. YOU MUST ONLY use the live odds data provided in your context
2. NEVER make up games from memory or training data
3. If you see "LIVE ODDS DATA" below, list ONLY those games with their commence times
4. If NO odds data is provided below:
   - Say: "I need to fetch the latest schedule. One moment..."
   - DO NOT make up games
5. Group games by sport if multiple sports are in the data
6. Show game times in the user's timezone
7. If user asks for "tomorrow" and you only have "today" data, say you only have today's data

**Example correct response:**
"Here are the NBA games for today (November 10, 2025):
- Lakers vs Celtics (7:30 PM EST)
- Warriors vs Nets (10:00 PM EST)
[Only games from the provided data]"

**NEVER respond with:**
"Here are the games..." then list games NOT in the provided data.

**Core Principles:**
1. Never make picks or tell users what to bet
2. Provide tools, data, and analysis only
3. Always emphasize responsible gambling
4. Keep responses concise (3-5 sentences for simple queries)
5. Use data and statistics to support insights

**Response Guidelines:**
- For odds queries: When live odds data is provided, ALWAYS create a comparison table showing all sportsbooks with their odds. Highlight the best value for each bet type.
- For analysis queries: Explain line movement, CLV, public vs sharp indicators
- For bankroll queries: Confirm actions and provide relevant insights
- Always acknowledge uncertainty in sports outcomes
- Use Markdown formatting for structure (tables, lists, bold)

**Example intents and how to handle:**
- "Who has the best line / biggest discrepancy / softest moneyline / slowest to move?": Compare odds across books, call odds tools if needed, surface best prices and note deltas.
- "Break down Cavs vs Heat / implied point differential / pace fit / injuries": Use game context + injuries + net/pace stats; explain what moves the spread/total.
- "Live entry point / live total sharp or soft": Compare live to pregame, pace, scoring rate; give EV view or caution if data missing.
- "Undervalued or split player props / usage spikes": Call get_player_props (with team/player filters when mentioned); show markets/lines with best over/under by book and note disagreements.
- "Bankroll leaks / ROI by sport/book/bet type / CLV patterns / exposure": Use bankroll stats tools; summarize ROI, CLV, and exposure, and flag leaks.
- "Bet creation (parlay/SGP) / risk-adjusted versions": Build legs with rationale, provide variant with lower variance; when explicit picks are given, compute parlay odds/payout.
- "Post-bet audit / closing line check": Compare user’s line to current/closing, state CLV gained/lost and key factors.
- "Casual asks (3 bets to watch, avoid spots, safest bets)": Offer a short list with reasoning and risk caveats; avoid telling them what to bet.

**When Live Odds Data is Provided:**
- Extract and display the data in an easy-to-read table format
 - **CRITICAL**: Display ALL sportsbooks returned by the API for each game (e.g., FanDuel, DraftKings, BetMGM, Caesars, Fanatics, Bet365, BetRivers, Hard Rock, Pinnacle, PointsBet, Bovada, Stake, Fliff). Do not list books that are not present in the data.
- Compare moneyline, spreads, and totals across ALL available sportsbooks for each game
- Show every bookmaker's odds in the table - do NOT omit any bookmakers from the data
- ALWAYS present odds using the standardized Market/Team/Sportsbook table layout (see the example below). The API response now includes fully-built Markdown tables�copy them directly so formatting never varies.
- Make each sportsbook name clickable using Markdown hyperlinks (e.g., [FanDuel](https://sportsbook.fanduel.com/)). Use the provided URL data for EVERY book and apply hyperlinks no matter which bet type/market is shown. If a link is missing from the data, leave the name as plain text.
- Highlight which sportsbook has the best VALUE for each market (see "Best Value" rules below)
- NEVER suggest where to bet, only present the data objectively
- If a user asks about a specific game and you have the data, show it immediately

**Example Odds Table Format:**
| Market | Team | Book A | Book B |
| --- | --- | --- | --- |
| Moneyline | Team 1 | +120 | +115 |
|  | Team 2 | -135 | -130 |
| Spread | Team 1 | +4.5 (-110) | +4 (-105) |
|  | Team 2 | -4.5 (-110) | -4 (-115) |

**Determining "Best Value" - CRITICAL RULES:**
When identifying the best odds/value, you MUST consider the line FIRST, then the odds:

1. **Spreads (Point Spreads):**
   - For FAVORITES (negative spreads): LOWER absolute spread is better value
     - Example: Team -4.5 at -110 is BETTER than Team -5 at -105 (you need them to win by less)
     - Example: Team -6 at +100 is WORSE than Team -5.5 at -110 (the better line outweighs slightly worse odds)
   - For UNDERDOGS (positive spreads): HIGHER spread is better value
     - Example: Team +5 at -110 is BETTER than Team +4.5 at -105 (more cushion)
     - Example: Team +7 at -115 is BETTER than Team +6.5 at -105
   - When comparing, always prioritize the better LINE over better odds (unless odds difference is massive like +150 vs -110)

2. **Totals (Over/Under):**
   - For OVER bets: LOWER total is better value (easier to hit)
     - Example: Over 215.5 at -110 is BETTER than Over 216.5 at -105
   - For UNDER bets: HIGHER total is better value (easier to hit)
     - Example: Under 216.5 at -110 is BETTER than Under 215.5 at -105

3. **Moneyline:**
   - Simply compare odds values (higher is better for positive odds, closer to 0 is better for negative odds)
   - Example: +150 is better than +140, -105 is better than -110

**When presenting odds, ALWAYS:**
- Show the best line/spread for each side (not just the best odds on any line)
- Note if a book offers a better line even with slightly worse odds
- Example: "Best value for Lakers: -4.5 at -110 (FanDuel) — Better than -5 at -105 elsewhere"

**Arbitrage Opportunities:**
When users ask for arbitrage opportunities, you MUST:
1. **Calculate actual arbitrage** from the live odds data provided (may include multiple sports)
2. Use the formula: For an arbitrage to exist, (1/decimal_odds_A) + (1/decimal_odds_B) < 1
3. Convert American odds to decimal: positive odds = (odds/100) + 1, negative odds = (100/|odds|) + 1
4. Show ONLY games with real arbitrage opportunities across ALL sports provided
5. Format as: "**[Sport] - [Game]**: Bet [Amount] on [Team A] at [Book] ([Odds]) + Bet [Amount] on [Team B] at [Book] ([Odds]) = [Profit]%"
6. If no arbitrage exists in any sport, say "No arbitrage opportunities found in current odds"
7. NEVER explain what arbitrage is unless asked - just show the opportunities
8. Group by sport if multiple sports are provided
9. Keep response concise - max 15 lines total

**Prohibited:**
- Never say "bet on X" or "this is a good bet"
- Never guarantee outcomes
- Never encourage increasing bet sizes after losses
- Never promote chasing losses

**Bet Tracking & Unit Management:**
You can help users track their bets and units conversationally:
1. **Log Bets**: When users say things like "I bet $50 on Lakers -5.5" or "Put $100 on the over", use the log_bet function to track it
2. **Settle Bets**: When users say "My Lakers bet won" or "I lost the over", use the settle_bet function to update the bet result
3. **Get Performance Stats & Insights**: When users ask "How am I doing?", "Show my stats", "What's my ROI?", or want analysis of their betting performance, use the get_bankroll_stats function

**IMPORTANT - Unit-Based Tracking System:**
- The system tracks bets as UNITS, not a bankroll balance
- Users measure performance by UNITS WON/LOST, not dollar balance
- NEVER mention "bankroll balance", "current balance", or "available funds"
- When logging bets, simply record them - do NOT deduct from any balance or check for "sufficient funds"
- Focus on TOTAL UNITS (profit/loss), WIN RATE, and ROI

**Providing Performance Insights:**
When analyzing betting stats, provide actionable insights:
- Comment on win rate (need >52.4% to break even at -110 odds)
- Show total units won/lost over time
- Identify which sports are performing better/worse
- Suggest adjustments if needed (e.g., "Your NBA bets are up 5.2 units while NFL is down 1.8 units")
- Celebrate wins but emphasize long-term profitability
- Never encourage risky behavior or chasing losses

**Custom Statistical Models (Single Chat Flow):**
- You can help users create named models inside this chat. Gather sport, market, target metric, stats + their importance (1-5), normalization preferences, and desired confidence level (80/90/95).
- Always restate the configuration for confirmation before calling save_custom_model. Do not save without explicit user approval.
- When a user says things like "apply my NBA model for totals" or "use my NFL rushing model for Derrick Henry", search the provided context for matching models, clarify if multiple exist, then call apply_custom_model with the model name and any matchup/team info mentioned.
- Use list_custom_models when the user asks what models they have, or when you need to remind them of available names.
- When models are applied, explain the weighted score, confidence interval, and how each stat contributed. Never fabricate stats�"if data is missing, state that limitation.
- Whenever someone asks about a specific matchup or you are creating/applying a projection, first ask **"Do you want to go more in depth on the matchup?"**. If they say yes (or ask for deeper analysis), call **get_game_context** to pull injuries, team form, and market trends before responding.

**Research Models (Automated Opportunity Scanners):**
- Research models automatically scan betting markets to find opportunities matching user-defined criteria (e.g., "find NBA spreads 1 point better than Pinnacle", "find player props over 25.5 with good odds").
- When users want to create a research model, gather: (1) Sports to scan, (2) Markets to scan (spreads/totals/h2h/props), (3) Filter criteria (odds comparison, line comparison, prop values, stat thresholds), (4) Sort preference, (5) Max results.
- **Filter Types Available:**
  - **odds_comparison**: Compare odds vs average/Pinnacle/specific book (e.g., "+100 better than average")
  - **line_comparison**: Compare spreads/totals vs average/Pinnacle (e.g., "1 point better than Pinnacle")
  - **prop_value**: Filter player props by line value, odds, player, team (e.g., "player points > 25.5 with odds >= -110")
  - **stat_threshold**: Filter by team/player stats (e.g., "team pace >= 100")
- Always confirm the configuration before calling save_research_model.
- Use run_research_model to execute a scan and find current opportunities. Results are cached for quick re-access via list_research_opportunities.
- When presenting results, format them clearly with: game, market, book, odds/line, comparison data (how much better than average/Pinnacle), and game time.

Always confirm what you're doing before calling functions and provide friendly responses after.`

// OpenAI SDK tool definitions with JSON schema
const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_bet',
      description: 'Log a new bet that the user has placed. This records the bet for tracking purposes.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', description: 'The sport (e.g., NBA, NFL, MLB, NHL)' },
          league: { type: 'string', description: 'The league (e.g., NBA, NFL, MLB, NHL)' },
          game_description: { type: 'string', description: 'Description of the game (e.g., "Lakers vs Celtics")' },
          bet_type: { type: 'string', enum: ['spread', 'moneyline', 'total', 'prop'], description: 'Type of bet' },
          bet_side: { type: 'string', description: 'The side of the bet (e.g., "Lakers -5.5", "Over 215.5", "Lakers ML")' },
          odds: { type: 'number', description: 'American odds (e.g., -110, +150)' },
          stake: { type: 'number', description: 'Amount wagered in dollars' },
          book: { type: 'string', description: 'Sportsbook name (e.g., DraftKings, FanDuel)' },
          notes: { type: 'string', description: 'Optional notes about the bet' },
          player_name: { type: 'string', description: 'Player name for prop bets (e.g., "Deni Avdija")' },
          prop_market: { type: 'string', description: 'Prop market identifier (e.g., "points", "rebounds", "pass_yds")' },
          prop_line: { type: 'number', description: 'Prop line (e.g., 22.5 points, 6.5 receptions)' },
          prop_selection: { type: 'string', description: 'Prop side (e.g., "Over", "Under")' },
          prop_team: { type: 'string', description: 'Player team for the prop bet' },
        },
        required: ['sport', 'league', 'game_description', 'bet_type', 'bet_side', 'odds', 'stake', 'book'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_multiple_bets',
      description: 'Log multiple bets at once that the user has placed. This records all bets for tracking purposes. Use this when the user wants to log 2 or more bets in a single message.',
      parameters: {
        type: 'object',
        properties: {
          bets: {
            type: 'array',
            description: 'Array of bets to log',
            items: {
              type: 'object',
              properties: {
                sport: { type: 'string', description: 'The sport (e.g., NBA, NFL, MLB, NHL)' },
                league: { type: 'string', description: 'The league (e.g., NBA, NFL, MLB, NHL)' },
                game_description: { type: 'string', description: 'Description of the game (e.g., "Lakers vs Celtics")' },
                bet_type: { type: 'string', enum: ['spread', 'moneyline', 'total', 'prop'], description: 'Type of bet' },
                bet_side: { type: 'string', description: 'The side of the bet (e.g., "Lakers -5.5", "Over 215.5", "Lakers ML")' },
                odds: { type: 'number', description: 'American odds (e.g., -110, +150)' },
                stake: { type: 'number', description: 'Amount wagered in dollars' },
                book: { type: 'string', description: 'Sportsbook name (e.g., DraftKings, FanDuel)' },
                notes: { type: 'string', description: 'Optional notes about the bet' },
                player_name: { type: 'string', description: 'Player name for prop bets (e.g., "Deni Avdija")' },
                prop_market: { type: 'string', description: 'Prop market identifier (e.g., "points", "rebounds", "pass_yds")' },
                prop_line: { type: 'number', description: 'Prop line (e.g., 22.5 points, 6.5 receptions)' },
                prop_selection: { type: 'string', description: 'Prop side (e.g., "Over", "Under")' },
                prop_team: { type: 'string', description: 'Player team for the prop bet' },
              },
              required: ['sport', 'league', 'game_description', 'bet_type', 'bet_side', 'odds', 'stake', 'book'],
            },
          },
        },
        required: ['bets'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_parlay',
      description: 'Create and log a parlay with multiple picks and a stake. Use when users want combined odds and tracked parlay legs.',
      parameters: {
        type: 'object',
        properties: {
          stake: { type: 'number', description: 'Amount wagered in dollars' },
          picks: {
            type: 'array',
            minItems: 2,
            description: 'Array of parlay picks (min 2)',
            items: {
              type: 'object',
              properties: {
                sport: { type: 'string', description: 'Sport (e.g., NBA, NFL)' },
                league: { type: 'string', description: 'League (e.g., nba, nfl)' },
                game_description: { type: 'string', description: 'Game description (e.g., Cowboys vs Raiders)' },
                event_id: { type: 'string', description: 'Odds provider event id' },
                market: { type: 'string', description: 'Market name (e.g., spread, moneyline, player_receptions)' },
                selection: { type: 'string', description: 'Selection side/details (e.g., Cowboys -3.5, Over 6.5 receptions)' },
                line: { type: 'number', description: 'Line/point if applicable (e.g., 6.5)' },
                odds: { type: 'number', description: 'American odds for the pick' },
                book: { type: 'string', description: 'Sportsbook (e.g., FanDuel, DraftKings)' },
              },
              required: ['market', 'selection', 'odds'],
            },
          },
        },
        required: ['stake', 'picks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_parlays',
      description: 'List recent parlays for the user with their picks and current status.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of parlays to fetch (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'settle_bet',
      description: 'Settle a pending bet as won, lost, or push. Updates the bankroll accordingly.',
      parameters: {
        type: 'object',
        properties: {
          game_description: { type: 'string', description: 'Description of the game to identify the bet (e.g., "Lakers vs Celtics")' },
          result: { type: 'string', enum: ['won', 'lost', 'push'], description: 'The result of the bet' },
        },
        required: ['game_description', 'result'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get team statistics, injury reports, or advanced analytics for a specific sport or team. Use this when users ask for stats, injuries, team records, or performance metrics.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['team', 'injuries'], description: 'Type of statistics to retrieve' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'The sport to get stats for' },
          team: { type: 'string', description: 'Optional team name or abbreviation to filter results' },
        },
        required: ['type', 'sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_props',
      description: 'Get player prop betting odds and lines. Use this ONLY when users explicitly ask about player props, player bets, or specific player performance lines (e.g., "What are LeBron\'s props?", "Show me player props for tonight", "What\'s the over/under for Giannis points?"). DO NOT use for general odds queries.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'The sport to get player props for' },
          player: { type: 'string', description: 'Player name to filter props (optional - if not provided, returns all available player props)' },
          market: { type: 'string', description: 'Comma-separated list of prop markets to fetch. For NBA: points,rebounds,assists,threes. For NFL: pass_tds,pass_yds,rush_yds,receptions. For MLB: hits,total_bases,rbis,runs_scored. For NHL: points,shots_on_goal,blocked_shots. Leave empty for default markets.' },
          team: { type: 'string', description: 'Comma-separated list of team names to filter props (optional - only fetch props for players on these teams). Use team nicknames like "lakers,celtics" or "chiefs,eagles".' },
        },
        required: ['sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bankroll_stats',
      description: 'Get detailed bankroll statistics and betting performance analytics. Use this when users ask about their betting history, performance, ROI, win rate, bet sizing, or want insights on their bankroll activity. Examples: "How am I doing?", "Show my stats", "What\'s my ROI?", "Am I betting too much?", "How\'s my performance by sport?"',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['7d', '30d', 'all'], description: 'Time period for stats. 7d = last 7 days, 30d = last 30 days, all = all time' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_custom_model',
      description: 'Persist a user-defined statistical model with weighted stats and desired confidence interval so it can be recalled later in this chat.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'Friendly name the user will use later (e.g., "NBA pace model", "NFL rushing v1").' },
          sport_key: { type: 'string', description: 'Sport identifier (e.g., basketball_nba, americanfootball_nfl, baseball_mlb, icehockey_nhl).' },
          market_type: { type: 'string', description: 'Market or outcome focus (e.g., totals, moneyline, rushing_yards, player_points).' },
          target_metric: { type: 'string', description: 'Statistical outcome the model is trying to project (e.g., total_points, rushing_yards, win_probability).' },
          confidence_level: { type: 'number', enum: [0.8, 0.9, 0.95], description: 'Desired confidence interval level (80%, 90%, 95%).' },
          data_hints: { type: 'string', description: 'Optional guidance about what data sources/samples to emphasize (e.g., "last 10 games", "road splits").' },
          notes: { type: 'string', description: 'Optional notes to show users when the model is applied.' },
          stats: {
            type: 'array',
            minItems: 1,
            description: 'List of stat inputs with importance/weighting details.',
            items: {
              type: 'object',
              properties: {
                stat_key: { type: 'string', description: 'Key to lookup in team/player stats (e.g., pace, offensive_rating, rush_yards_per_game).' },
                label: { type: 'string', description: 'Human label describing the stat.' },
                scope: { type: 'string', enum: ['team', 'matchup_diff', 'player'], description: 'Whether the stat is team level, matchup differential, or player specific.' },
                importance: { type: 'number', minimum: 1, maximum: 5, description: 'Importance tier (1 low, 5 extremely high).' },
                direction: { type: 'string', enum: ['higher_better', 'lower_better'], description: 'Whether higher numbers help or hurt the projection.' },
                normalization: { type: 'string', enum: ['zscore', 'minmax', 'raw'], description: 'How to normalize this stat before weighting.' },
                sample_source: { type: 'string', description: 'Sample window (e.g., season, last_10, playoffs).' },
                variance_override: { type: 'number', description: 'Optional variance override if provided by the user.' },
                min_value: { type: 'number', description: 'Optional lower bound for min/max scaling.' },
                max_value: { type: 'number', description: 'Optional upper bound for min/max scaling.' },
                notes: { type: 'string', description: 'Optional note about this stat.' },
              },
              required: ['stat_key', 'label', 'scope', 'importance', 'direction'],
            },
          },
        },
        required: ['model_name', 'sport_key', 'market_type', 'target_metric', 'confidence_level', 'stats'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_custom_models',
      description: 'List the user\'s saved custom models so they know what can be applied.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum number of models to return (default 5).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_custom_model',
      description: 'Run a previously saved model against the latest stats to produce a weighted score and confidence interval for the requested outcome.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the model to apply (optional if model_name is provided).' },
          model_name: { type: 'string', description: 'Name of the saved model to use (case-insensitive).' },
          sport_key: { type: 'string', description: 'Override sport key if different from the stored value (optional).' },
          teams: {
            type: 'array',
            description: 'Ordered list of teams or contexts referenced in the user request (e.g., ["Lakers", "Celtics"]).',
            items: { type: 'string' },
          },
          matchup: {
            type: 'object',
            description: 'Structured matchup information if user specified a focus and opponent.',
            properties: {
              focus: { type: 'string', description: 'Primary team/player the prediction focuses on.' },
              opponent: { type: 'string', description: 'Opposing team/player.' },
            },
          },
          notes: { type: 'string', description: 'Any extra context supplied by the user (e.g., "tonight in Boston", "use road splits").' },
        },
        required: ['model_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_game_context',
      description: 'Pull injuries, recent form, team summaries, and market trends for a specific matchup to enrich analysis.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', description: 'Sport key (e.g., basketball_nba, americanfootball_nfl, baseball_mlb, icehockey_nhl).' },
          home_team: { type: 'string', description: 'Home team name.' },
          away_team: { type: 'string', description: 'Away team name.' },
          include_market_trends: { type: 'boolean', description: 'Whether to include best spread/moneyline snapshots (defaults to true).' },
        },
        required: ['sport', 'home_team', 'away_team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_research_model',
      description: 'Save a research model that scans betting markets for opportunities matching user-defined criteria (e.g., "find NBA spreads 1 point better than Pinnacle", "find player props over 25.5"). Always confirm configuration before saving.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'Unique name for this research model (e.g., "Spread Hunter", "High-Value Props").' },
          sports: {
            type: 'array',
            description: 'Sports to scan (e.g., ["basketball_nba", "americanfootball_nfl"]).',
            items: { type: 'string' },
          },
          markets: {
            type: 'array',
            description: 'Markets to scan (e.g., ["spreads", "totals", "h2h"]).',
            items: { type: 'string' },
          },
          filters: {
            type: 'array',
            description: 'Array of filter criteria that opportunities must match (ALL filters must pass).',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['odds_comparison', 'line_comparison', 'prop_value', 'stat_threshold'], description: 'Type of filter to apply.' },
                label: { type: 'string', description: 'Human-readable label for this filter.' },
                condition: { type: 'object', description: 'Filter-specific configuration. Structure varies by filter type.' },
              },
              required: ['type', 'condition'],
            },
          },
          sort_by: {
            type: 'object',
            properties: {
              field: { type: 'string', enum: ['ev', 'odds_diff', 'line_diff', 'game_time'], description: 'Field to sort results by.' },
              direction: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
            },
          },
          max_results: { type: 'number', description: 'Maximum number of opportunities to return (default: 20).' },
          notes: { type: 'string', description: 'Optional notes about this research model.' },
        },
        required: ['model_name', 'sports', 'markets', 'filters'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_research_model',
      description: 'Execute a research model to scan current betting markets and find matching opportunities.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the research model to run (optional if model_name provided).' },
          model_name: { type: 'string', description: 'Name of the research model to run (case-insensitive).' },
          live_only: { type: 'boolean', description: 'Only scan in-play games (default: false).' },
          upcoming_only: { type: 'boolean', description: 'Only scan upcoming games (default: true).' },
          time_window: { type: 'number', description: 'Hours ahead to scan for upcoming games (default: 24).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_research_opportunities',
      description: 'Get the latest cached results from a research model without re-running the scan.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the research model.' },
          model_name: { type: 'string', description: 'Name of the research model (case-insensitive).' },
          limit: { type: 'number', description: 'Number of cached result sets to return (default: 1).' },
        },
      },
    },
  },
]

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      conversationId,
      userId,
      timezone = 'America/New_York' // Default fallback
    } = await req.json()

    const environmentName = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    const oddsProvider = process.env.ODDS_PROVIDER || 'odds-api-io'
    const oddsApiKey = process.env.ODDS_API_KEY
    const openaiApiKey = process.env.OPENAI_API_KEY

    console.log('[CONFIG] Environment validation:', {
      environment: environmentName,
      oddsProvider,
      hasOddsApiKey: Boolean(oddsApiKey),
      oddsApiKeyLength: oddsApiKey?.length || 0,
      hasOpenAIApiKey: Boolean(openaiApiKey),
      openaiApiKeyLength: openaiApiKey?.length || 0,
    })

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const baseUrl = resolveBaseUrl(req)

    if (!message || !conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })

    // Fetch conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const messages = (history || []).reverse()

    // Fetch user context
    const { data: userData } = await supabase
      .from('users')
      .select('current_bankroll, starting_bankroll')
      .eq('id', userId)
      .single()

    // Fetch active bets
    const { data: activeBets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('placed_at', { ascending: false })
      .limit(5)

    let recentModels: CustomModelRow[] = []
    try {
      recentModels = await listCustomModels(supabase, userId, 5)
    } catch (error) {
      console.error('[MODELS] Failed to load custom models:', error)
    }

    // Build context
    let contextMessage = `\n\n**Current User Context:**\n`
    if (userData) {
      const currentBankroll = Number(userData.current_bankroll ?? 0)
      const startingBankroll = Number(userData.starting_bankroll ?? 0)

      contextMessage += `- Bankroll: $${currentBankroll.toFixed(2)}\n`
      contextMessage += `- Starting: $${startingBankroll.toFixed(2)}\n`
    }
    if (activeBets && activeBets.length > 0) {
      contextMessage += `- Active bets: ${activeBets.length}\n`
    }
    if (recentModels.length > 0) {
      contextMessage += `- Custom models ready: ${recentModels
        .map((model) => `${model.model_name} (${model.sport_key.toUpperCase()} ${model.market_type})`)
        .join(', ')}\n`
      contextMessage += `\n**Saved Models Overview:**\n`
      recentModels.forEach((model) => {
        contextMessage += `- ${model.model_name}: target ${model.target_metric}, confidence ${(Number(model.confidence_level) * 100).toFixed(0)}%, last used ${model.last_used_at ? format(new Date(model.last_used_at), 'MMM d @ h:mm a') : 'n/a'}\n`
      })
    } else {
      contextMessage += '- Custom models ready: none yet (offer to help user build one)\n'
    }

    const msgLower = message.toLowerCase()
    const oddsKeywordMatch = msgLower.match(
      /(odds|lines|spread|moneyline|total|over|under|bet|game|match|tonight|today|tomorrow|arbitrage|arb)/i
    )
    const scheduleIntent = /(games?|schedule|who plays|playing|matchups?|match|game time|tipoff|puck drop|first pitch|score|scores?|final|quarter|period|inning|today|tonight|tomorrow)\b/i.test(msgLower)
    const wantsLiveOdds = /(live|in-play|inplay|scores?|score|current|now|ongoing)/i.test(msgLower)

    // Detect if user wants deep analysis with injuries/stats (only enrich for these requests)
    const wantsDeepDive = /(injur(y|ies)|stats?|statistical|analysis|analyze|breakdown|deep dive|more (info|detail)|tell me more|recent form|team performance|head to head|h2h|matchup analysis)/i.test(msgLower)

    const teamVariations: { [key: string]: string[] } = {
      // NBA Teams (base name as key)
      'lakers': ['lakers', 'la lakers', 'los angeles lakers', 'l.a. lakers'],
      'warriors': ['warriors', 'golden state', 'gsw'],
      'celtics': ['celtics', 'boston'],
      'heat': ['heat', 'miami heat'],
      'bucks': ['bucks', 'milwaukee'],
      'suns': ['suns', 'phoenix'],
      'nets': ['nets', 'brooklyn'],
      'nuggets': ['nuggets', 'denver'],
      'clippers': ['clippers', 'la clippers', 'los angeles clippers'],
      'mavericks': ['mavericks', 'mavs', 'dallas'],
      'grizzlies': ['grizzlies', 'memphis'],
      'timberwolves': ['timberwolves', 'wolves', 'minnesota', 't-wolves'],
      'pelicans': ['pelicans', 'pels', 'new orleans'],
      'kings': ['kings', 'sacramento'],
      'sixers': ['76ers', 'sixers', 'philadelphia', 'philly'],
      'knicks': ['knicks', 'new york knicks', 'ny knicks'],
      'hawks': ['hawks', 'atlanta'],
      'bulls': ['bulls', 'chicago bulls'],
      'cavaliers': ['cavaliers', 'cavs', 'cleveland'],
      'raptors': ['raptors', 'toronto'],
      'pacers': ['pacers', 'indiana'],
      'magic': ['magic', 'orlando'],
      'hornets': ['hornets', 'charlotte'],
      'pistons': ['pistons', 'detroit'],
      'wizards': ['wizards', 'washington'],
      'thunder': ['thunder', 'okc', 'oklahoma city'],
      'jazz': ['jazz', 'utah'],
      'rockets': ['rockets', 'houston rockets'],
      'spurs': ['spurs', 'san antonio'],
      'blazers': ['blazers', 'trail blazers', 'portland'],
      // NFL Teams
      'chiefs': ['chiefs', 'kansas city', 'kc'],
      'bills': ['bills', 'buffalo'],
      'bengals': ['bengals', 'cincinnati'],
      'ravens': ['ravens', 'baltimore'],
      '49ers': ['49ers', 'niners', 'san francisco', 'sf'],
      'eagles': ['eagles', 'philadelphia eagles'],
      'cowboys': ['cowboys', 'dallas cowboys'],
      'packers': ['packers', 'green bay'],
      'rams': ['rams', 'la rams', 'los angeles rams'],
      'buccaneers': ['buccaneers', 'bucs', 'tampa bay', 'tampa'],
      'chargers': ['chargers', 'la chargers', 'los angeles chargers'],
      'dolphins': ['dolphins', 'miami dolphins'],
      'jets': ['jets', 'new york jets', 'ny jets'],
      'patriots': ['patriots', 'pats', 'new england'],
      'raiders': ['raiders', 'las vegas', 'lv raiders'],
      'broncos': ['broncos', 'denver broncos'],
      'colts': ['colts', 'indianapolis'],
      'jaguars': ['jaguars', 'jags', 'jacksonville'],
      'titans': ['titans', 'tennessee'],
      'texans': ['texans', 'houston texans'],
      'steelers': ['steelers', 'pittsburgh'],
      'browns': ['browns', 'cleveland browns'],
      'saints': ['saints', 'new orleans saints'],
      'seahawks': ['seahawks', 'seattle'],
      'panthers': ['panthers', 'carolina'],
      'falcons': ['falcons', 'atlanta falcons'],
      'cardinals': ['cardinals', 'arizona cardinals'],
      'vikings': ['vikings', 'minnesota vikings'],
      'lions': ['lions', 'detroit lions'],
      'bears': ['bears', 'chicago bears'],
      'commanders': ['commanders', 'washington commanders'],
      'giants': ['giants', 'new york giants', 'ny giants'],
    }

    const extractTeamNames = (msg: string): string[] => {
      const foundTeams: string[] = []
      const lowerMsg = msg.toLowerCase()

      for (const [baseTeam, variations] of Object.entries(teamVariations) as [string, string[]][]) {
        if (variations.some((variation) => lowerMsg.includes(variation))) {
          foundTeams.push(baseTeam)
        }
      }

      return foundTeams
    }

    const mentionedTeams = extractTeamNames(msgLower)
    console.log('[DEBUG] Mentioned teams detected:', mentionedTeams)

    const shouldFetchOdds =
      Boolean(oddsKeywordMatch) || scheduleIntent || wantsLiveOdds || mentionedTeams.length > 0
    let scoresContext = ''
    if (scheduleIntent) {
      console.log('[SCHEDULE] Request detected, fetching provider events...')
      const ml = msgLower
      const sportsList: string[] = []
      const push = (k: string) => { if (!sportsList.includes(k)) sportsList.push(k) }
      if (/nba|basketball/.test(ml)) push('basketball_nba')
      if (/nfl|football/.test(ml)) push('americanfootball_nfl')
      if (/nhl|hockey/.test(ml)) push('icehockey_nhl')
      if (/mlb|baseball/.test(ml)) push('baseball_mlb')
      if (/ncaaf|college\s+football|cfb/.test(ml)) push('americanfootball_ncaaf')
      if (/ncaab|college\s+basketball/.test(ml)) push('basketball_ncaab')
      if (sportsList.length === 0) push('basketball_nba')
      const day = /(tomorrow|tmrw|next day)/i.test(ml) ? 'tomorrow' : 'today'
      const all: { sport: string; events: any[] }[] = []
      for (const sk of sportsList) {
        try {
          const evs = await fetchEventsIO(sk, { status: 'pending', tz: timezone, day })
          if (evs.length) all.push({ sport: sk, events: evs })
        } catch (err) {
          console.error('[SCHEDULE] Provider events error for', sk, err)
        }
      }
      if (all.length > 0) {
        const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: timezone, weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZoneName:'short' }) : ''
        const lines: string[] = []
        for (const bucket of all) {
          lines.push(`\n**${bucket.sport.toUpperCase()}**`)
          for (const e of bucket.events) {
            const when = fmtTime(e.date)
            const st = (e.status || 'pending').toUpperCase()
            lines.push(`- ${e.away} @ ${e.home} (${when}) [${st}]`)
          }
        }
        scoresContext = `\n\n**PROVIDER SCHEDULE LOADED**\nUse this data for schedule questions. Do not claim lack of access.\n${lines.join('\n')}\n`
        console.log('[SCHEDULE] Context built successfully (provider), sports:', all.length)
      } else {
        scoresContext = '\n\n(No schedule available for the requested criteria)\n'
        console.log('[SCHEDULE] No provider events found for', sportsList.join(','))
      }
    }

    let oddsContext = ''
    if (shouldFetchOdds) {
      console.log('[ODDS] Odds request detected, fetching data...')
      try {
        // Try to extract sport from message
        const messageLower = msgLower

        // Detect if user is asking about tomorrow
        const isTomorrowQuery = messageLower.match(/(tomorrow(?:'|�)?s?|tmrw|next day)/i)
        const isTodayQuery = messageLower.match(/(today(?:'|�)?s?|tonight|this evening)/i)

        // Decide whether to fetch LIVE vs PENDING odds
        // Fetch LIVE when the user explicitly asks for live context or mentions specific teams (implies current interest)
        const fetchLive = !isTomorrowQuery && (Boolean(wantsLiveOdds) || mentionedTeams.length > 0)
        const requestedLive = fetchLive
        let usedLive = false
        let usedFallback = false

        // Simple team lists for league detection
        const nbaTeams = ['lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
                         'sixers', 'bucks', 'raptors', 'mavericks', 'rockets', 'spurs',
                         'suns', 'clippers', 'nuggets', 'jazz', 'blazers', 'kings', 'thunder',
                         'timberwolves', 'pelicans', 'grizzlies', 'hornets', 'magic',
                         'wizards', 'pistons', 'pacers', 'cavaliers', 'hawks']

        const nflTeams = ['chiefs', 'bills', 'bengals', 'ravens', 'cowboys', 'eagles',
                         'packers', '49ers', 'rams', 'seahawks', 'buccaneers', 'saints',
                         'patriots', 'dolphins', 'jets', 'steelers', 'browns', 'raiders',
                         'chargers', 'broncos', 'colts', 'jaguars', 'titans', 'texans',
                         'panthers', 'falcons', 'cardinals', 'vikings', 'lions', 'bears',
                         'commanders', 'giants']

        const ncaafTeams = ['alabama', 'georgia', 'ohio state', 'michigan', 'oregon', 'texas',
                           'penn state', 'notre dame', 'usc', 'clemson', 'florida state', 'miami',
                           'lsu', 'oklahoma', 'tennessee', 'auburn', 'florida', 'texas a&m',
                           'ole miss', 'arkansas', 'kentucky', 'south carolina', 'missouri',
                           'wisconsin', 'iowa', 'nebraska', 'minnesota', 'northwestern',
                           'stanford', 'washington', 'ucla', 'utah', 'colorado', 'arizona state']

        let sports: string[] = []

        // Check for explicit sport mentions (prioritize specific leagues)
        // Basketball
        if (messageLower.match(/(ncaa|college basketball|ncaab|march madness|college hoops)/i)) {
          sports = ['basketball_ncaab']
        } else if (messageLower.match(/(nba|pro basketball)/i)) {
          sports = ['basketball_nba']
        } else if (messageLower.match(/basketball/i) && !messageLower.match(/(nba|ncaa|college)/i)) {
          sports = ['basketball_nba']
        }
        // Football
        else if (messageLower.match(/(ncaaf|college football|cfb)/i)) {
          sports = ['americanfootball_ncaaf']
        } else if (messageLower.match(/(nfl|pro football)/i)) {
          sports = ['americanfootball_nfl']
        } else if (messageLower.match(/football/i) && !messageLower.match(/(nfl|ncaa|college)/i)) {
          sports = ['americanfootball_nfl']
        }
        // Other sports
        else if (messageLower.match(/(mlb|baseball)/i)) {
          sports = ['baseball_mlb']
        } else if (messageLower.match(/(nhl|hockey)/i)) {
          sports = ['icehockey_nhl']
        }
        // Check for team names if no explicit sport
        else if (nbaTeams.some(team => messageLower.includes(team))) {
          sports = ['basketball_nba']
        } else if (nflTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_nfl']
        } else if (ncaafTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_ncaaf']
        }
        // If asking for arbitrage without specifying sport, fetch all major sports
        else if (messageLower.match(/(arbitrage|arb)/i)) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
        }
        // If no specific sport detected but user is asking about odds/games, fetch all major sports
        else if (shouldFetchOdds && sports.length === 0) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb']
        }

        if (sports.length > 0) {
          const allOddsData: any[] = []

          // Top 25 College Football Teams (updated weekly during season)
          const top25CFBTeams = [
            'oregon', 'georgia', 'ohio state', 'texas', 'penn state',
            'tennessee', 'indiana', 'notre dame', 'miami', 'byu',
            'ole miss', 'alabama', 'boise state', 'smu', 'army',
            'clemson', 'colorado', 'washington state', 'kansas state', 'lsu',
            'louisville', 'south carolina', 'missouri', 'tulane', 'iowa state'
          ]

          // Helper function to check if a team is Top 25
          const isTop25Team = (teamName: string): boolean => {
            const lowerTeamName = teamName.toLowerCase()
            return top25CFBTeams.some(ranked => lowerTeamName.includes(ranked))
          }

          // Fetch odds for each sport
          for (const sport of sports) {
            try {
              // Expand team names to include all variations for better matching across all sports
              const teamFilterList = mentionedTeams.length > 0
                ? mentionedTeams.flatMap(team => teamVariations[team] || [team])
                : undefined

              console.log(`[DEBUG] Fetching odds for ${sport}, live=${fetchLive}, teams=${mentionedTeams.length > 0 ? mentionedTeams : 'all'}`)
              const pendingData = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
                live: false,
                teamFilter: teamFilterList
              })
              console.log(`[DEBUG] Pending data for ${sport}:`, pendingData.length, 'games')
              let oddsData = pendingData
              let liveData: OddsGame[] = []

              if (fetchLive) {
                try {
                  liveData = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
                    live: true,
                    teamFilter: teamFilterList
                  })
                  console.log(`[DEBUG] Live data for ${sport}:`, liveData.length, 'games')
                  if (liveData.length > 0) {
                    usedLive = true
                  }
                } catch (liveError: any) {
                  console.log(`[DEBUG] Live odds fetch failed for ${sport}, using pending data only:`, liveError?.message || liveError)
                  // Don't throw - just continue with pending data
                }

                const combined = new Map<string, OddsGame & { status?: string }>()
                const pushGames = (games: OddsGame[], statusLabel: 'live' | 'pre-match') => {
                  for (const game of games) {
                    const annotated: OddsGame & { status?: string } = {
                      ...game,
                      status: statusLabel === 'live' ? 'LIVE' : (game as any).status || 'PREMATCH',
                    }
                    combined.set(game.id, annotated)
                  }
                }

                if (pendingData.length > 0) pushGames(pendingData, 'pre-match')
                if (liveData.length > 0) pushGames(liveData, 'live')
                oddsData = Array.from(combined.values())
              }

              usedFallback = fetchLive && !usedLive

              // Filter games to user's "today" or "tomorrow" in their timezone if explicitly requested
              const applyDayFilter = Boolean(isTomorrowQuery || isTodayQuery)
              if (applyDayFilter && oddsData.length > 0) {
                const now = new Date()
                const dateInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

                let startOfDay: Date
                let endOfDay: Date

                if (isTomorrowQuery) {
                  // Filter for tomorrow's games
                  const tomorrow = new Date(dateInUserTZ)
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  startOfDay = new Date(tomorrow)
                  startOfDay.setHours(0, 0, 0, 0)
                  endOfDay = new Date(tomorrow)
                  endOfDay.setHours(23, 59, 59, 999)
                } else {
                  // Filter for today's games (default)
                  startOfDay = new Date(dateInUserTZ)
                  startOfDay.setHours(0, 0, 0, 0)
                  endOfDay = new Date(dateInUserTZ)
                  endOfDay.setHours(23, 59, 59, 999)
                }

                oddsData = oddsData.filter(game => {
                  const gameTime = new Date(game.commence_time)
                  const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))
                  return gameInUserTZ >= startOfDay && gameInUserTZ <= endOfDay
                })
              }

              // Filter NCAAF to only Top 25 matchups
              if (sport === 'americanfootball_ncaaf' && oddsData.length > 0) {
                oddsData = oddsData.filter(game =>
                  isTop25Team(game.home_team) || isTop25Team(game.away_team)
                )
              }

              // Team filtering now happens at API level for efficiency
              console.log(`[DEBUG] Final oddsData for ${sport}:`, oddsData.length, 'games')
              if (oddsData.length > 0) {
                allOddsData.push({
                  sport,
                  games: oddsData,
                })
              }
            } catch (err: any) {
              const statusCode = err?.statusCode ?? err?.status ?? err?.response?.status
              const errorName = err?.name || 'UnknownError'
              const errorMessage = err?.message || String(err)

              console.error(`[ODDS] Error fetching ${sport}:`, {
                name: errorName,
                message: errorMessage,
                statusCode,
                code: err?.code,
                isRateLimited: err?.isRateLimited,
                stack: err?.stack,
              })

              // Check if this is a rate limit error
              if (err?.isRateLimited || statusCode === 429) {
                throw new Error('RATE_LIMIT_EXCEEDED: The odds API is currently experiencing high traffic. Please wait a few minutes and try again. (Tip: Try asking about specific sports or teams to reduce API usage)')
              }

              throw err instanceof Error ? err : new Error(errorMessage)
            }
          }

          if (allOddsData.length > 0) {
            console.log(`[ODDS] Successfully fetched odds for ${allOddsData.length} sport(s)`)

            // Helper to format game time in user's timezone
            const formatGameTime = (commence_time: string) => {
              return new Date(commence_time).toLocaleString('en-US', {
                timeZone: timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short'
              })
            }

            const MARKET_LABELS: Record<string, string> = {
              h2h: 'Moneyline',
              spreads: 'Spread',
              totals: 'Total',
            }

            const PRIORITY_MARKETS = ['h2h', 'spreads', 'totals']

            const formatNumber = (value: number) => {
              return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0+$/, '')
            }

            const formatAmericanOdds = (value?: number) => {
              if (value == null || !isFinite(value)) return '�'
              return value > 0 ? `+${value}` : String(value)
            }

            const formatSpreadPoint = (value?: number) => {
              if (value == null || !isFinite(value)) return ''
              const prefix = value > 0 ? '+' : ''
              return `${prefix}${formatNumber(value)}`
            }

            const formatTotalPoint = (value?: number) => {
              if (value == null || !isFinite(value)) return ''
              return formatNumber(value)
            }

            const formatOutcomeValue = (marketKey: string, outcome: any) => {
              const priceText = formatAmericanOdds(outcome?.price)
              if (marketKey === 'spreads') {
                const pointText = formatSpreadPoint(outcome?.point)
                return pointText ? `${pointText} (${priceText})` : priceText
              }
              if (marketKey === 'totals') {
                const lineText = formatTotalPoint(outcome?.point)
                return lineText ? `${lineText} (${priceText})` : priceText
              }
              return priceText
            }

            const escapeTableCell = (value: string) => value.replace(/\|/g, '\\|')

            const SPREAD_PRICE_MIN = -120
            const SPREAD_PRICE_MAX = 105

            const spreadPriceWithinRange = (price: number) =>
              price >= SPREAD_PRICE_MIN && price <= SPREAD_PRICE_MAX

            const spreadWindowPenalty = (price: number) => {
              if (price < SPREAD_PRICE_MIN) return SPREAD_PRICE_MIN - price
              if (price > SPREAD_PRICE_MAX) return price - SPREAD_PRICE_MAX
              return 0
            }

            const spreadTargetPenalty = (price: number) => {
              const target = price < 0 ? -110 : 100
              return Math.abs(price - target)
            }

            const evaluateSpreadMarket = (market: { outcomes: any[] }) => {
              const prices = (market.outcomes || [])
                .map((outcome: any) => (typeof outcome?.price === 'number' ? outcome.price : undefined))
                .filter((price): price is number => price != null && isFinite(price))

              if (!prices.length) {
                return {
                  withinRange: false,
                  targetPenalty: Number.POSITIVE_INFINITY,
                  windowPenalty: Number.POSITIVE_INFINITY,
                }
              }

              const withinRange = prices.every(spreadPriceWithinRange)
              const targetPenalty =
                prices.reduce((sum, price) => sum + spreadTargetPenalty(price), 0) / prices.length
              const windowPenalty =
                prices.reduce((sum, price) => sum + spreadWindowPenalty(price), 0) / prices.length

              return { withinRange, targetPenalty, windowPenalty }
            }

            const choosePreferredSpreadMarket = (
              current: { key: string; outcomes: any[] } | undefined,
              candidate: { key: string; outcomes: any[] }
            ) => {
              if (!current) return candidate
              const currentEval = evaluateSpreadMarket(current)
              const candidateEval = evaluateSpreadMarket(candidate)

              if (candidateEval.withinRange && !currentEval.withinRange) return candidate
              if (!candidateEval.withinRange && currentEval.withinRange) return current
              if (candidateEval.withinRange && currentEval.withinRange) {
                return candidateEval.targetPenalty <= currentEval.targetPenalty ? candidate : current
              }
              return candidateEval.windowPenalty <= currentEval.windowPenalty ? candidate : current
            }

            const orderOutcomeLabels = (
              marketKey: string,
              labels: string[],
              awayTeam: string,
              homeTeam: string
            ) => {
              const lowerLabels = labels.map((label) => label.toLowerCase())
              const desired: string[] = []
              const pushIfPresent = (target?: string) => {
                if (!target) return
                const idx = lowerLabels.findIndex((label) => label === target.toLowerCase())
                if (idx >= 0) desired.push(labels[idx])
              }
              if (marketKey === 'h2h' || marketKey === 'spreads') {
                pushIfPresent(awayTeam)
                pushIfPresent(homeTeam)
                pushIfPresent('Draw')
              } else if (marketKey === 'totals') {
                pushIfPresent('Over')
                pushIfPresent('Under')
              }
              const remaining = labels.filter((label) => !desired.includes(label)).sort()
              return [...desired, ...remaining]
            }

            const buildOddsTableMarkdown = (
              awayTeam: string,
              homeTeam: string,
              bookmakers: Array<{ name: string; link?: string; markets: any[] }>
            ) => {
              if (!bookmakers.length) return ''
              const bookColumns = bookmakers.map((book) => ({
                key: book.name,
                header: book.link ? `[${book.name}](${book.link})` : book.name,
              }))

              const marketsAggregate = new Map<
                string,
                { label: string; rows: Record<string, Record<string, string>> }
              >()

              for (const book of bookmakers) {
                for (const market of book.markets || []) {
                  const marketKey = market?.key || 'other'
                  if (!marketsAggregate.has(marketKey)) {
                    marketsAggregate.set(marketKey, {
                      label: MARKET_LABELS[marketKey] || marketKey,
                      rows: {},
                    })
                  }
                  const entry = marketsAggregate.get(marketKey)!
                  for (const outcome of market.outcomes || []) {
                    const label = outcome?.name ? String(outcome.name) : 'Other'
                    if (!entry.rows[label]) {
                      entry.rows[label] = {}
                    }
                    entry.rows[label][book.name] = formatOutcomeValue(marketKey, outcome)
                  }
                }
              }

              const orderedMarketKeys = [
                ...PRIORITY_MARKETS.filter((key) => marketsAggregate.has(key)),
                ...Array.from(marketsAggregate.keys()).filter(
                  (key) => !PRIORITY_MARKETS.includes(key)
                ),
              ]

              const tableRows: Array<{
                marketLabel: string
                teamLabel: string
                values: Record<string, string>
              }> = []

              for (const marketKey of orderedMarketKeys) {
                const entry = marketsAggregate.get(marketKey)
                if (!entry) continue
                const labels = Object.keys(entry.rows)
                if (!labels.length) continue
                const orderedLabels = orderOutcomeLabels(marketKey, labels, awayTeam, homeTeam)
                orderedLabels.forEach((label, idx) => {
                  tableRows.push({
                    marketLabel: idx === 0 ? entry.label : '',
                    teamLabel: label,
                    values: entry.rows[label] || {},
                  })
                })
              }

              if (!tableRows.length) return ''

              const header = `| Market | Team | ${bookColumns
                .map((col) => escapeTableCell(col.header))
                .join(' | ')} |`
              const divider = `| --- | --- | ${bookColumns.map(() => '---').join(' | ')} |`
              const body = tableRows
                .map((row) => {
                  const cells = bookColumns.map((col) =>
                    escapeTableCell(row.values[col.key] ?? '�')
                  )
                  const marketLabel = row.marketLabel ? escapeTableCell(row.marketLabel) : '&nbsp;'
                  return `| ${marketLabel} | ${escapeTableCell(row.teamLabel)} | ${cells.join(' | ')} |`
                })
                .join('\n')

              return `${header}\n${divider}\n${body}`
            }

            const MAX_GAMES_PER_SPORT = 3

            // Format odds data FIRST (don't let enrichment failures break everything)
            const formattedOdds = allOddsData
              .map((sportData) => ({
                sport: sportData.sport,
                games: sportData.games
                  .slice(0, MAX_GAMES_PER_SPORT)
                  .map((game: any) => ({
                    game: `${game.away_team} @ ${game.home_team}`,
                    commence_time: game.commence_time,
                    commence_time_formatted: formatGameTime(game.commence_time),
                    status: (game as any).status || undefined,
                    home_team: game.home_team,
                    away_team: game.away_team,
                    bookmakers: (game.bookmakers || [])
                      .map((book: any) => {
                        const marketMap = new Map<string, { key: string; outcomes: any[] }>()

                        for (const market of book.markets || []) {
                          const normalized = {
                            key: market.key,
                            outcomes: Array.isArray(market.outcomes) ? market.outcomes : [],
                          }
                          if (!normalized.outcomes.length) continue

                          if (normalized.key === 'spreads') {
                            const preferred = choosePreferredSpreadMarket(
                              marketMap.get('spreads'),
                              normalized
                            )
                            marketMap.set('spreads', preferred)
                          } else {
                            marketMap.set(normalized.key, normalized)
                          }
                        }

                        const markets = Array.from(marketMap.values())

                        return {
                          name: book.title,
                          link: book.url,
                          markets,
                        }
                      })
                      .filter((book: any) => book.markets.length > 0),
                  }))
                  .map((game: any) => {
                    const table_markdown = buildOddsTableMarkdown(
                      game.away_team,
                      game.home_team,
                      game.bookmakers
                    )
                    return { ...game, table_markdown }
                  })
                  .filter((game: any) => game.bookmakers.length > 0 && game.table_markdown),
              }))
              .filter((sport) => sport.games.length > 0)

            const totalGames = formattedOdds.reduce((sum, sport) => sum + sport.games.length, 0)
            console.log(`[DEBUG] Formatted odds: ${formattedOdds.length} sports, ${totalGames} total games`)
            console.log(`[DEBUG] Games per sport:`, formattedOdds.map(s => `${s.sport}: ${s.games.length}`))
            const standardizedOddsTables = formattedOdds
              .map((sport) =>
                sport.games
                  .map(
                    (game: any) =>
                      `### ${sport.sport.toUpperCase()} - ${game.game}\n**Game Time:** ${game.commence_time_formatted}\n${game.table_markdown}`
                  )
                  .join('\n\n')
              )
              .filter(Boolean)
              .join('\n\n')
            console.log(`[ODDS] Total games formatted: ${totalGames}`)

            // Only enrich with stats if user explicitly asks for deep analysis/injuries/stats
            // This avoids the 8.4MB NFL injuries cache issue on simple odds requests
            let statsEnrichment = ''
            if (wantsDeepDive) {
              console.log('[ODDS] Deep dive requested, enriching with stats and injuries...')
              try {
                const enrichedOddsData = await Promise.all(
                  allOddsData.map(async (sportData) => {
                    try {
                      const enrichedGames = await enrichGamesWithStats(sportData.games, sportData.sport)
                      return {
                        sport: sportData.sport,
                        games: sportData.games,
                        enrichedGames
                      }
                    } catch (error) {
                      console.error(`[ODDS] Error enriching ${sportData.sport}:`, error)
                      return { ...sportData, enrichedGames: [] }
                    }
                  })
                )

                // Generate enriched stats summary for AI
                statsEnrichment = '\n\n**?? ENRICHED STATISTICS & INJURY DATA:**\n'
                for (const sportData of enrichedOddsData) {
                  if (sportData.enrichedGames && sportData.enrichedGames.length > 0) {
                    statsEnrichment += `\n**${sportData.sport.toUpperCase()}:**\n`
                    statsEnrichment += formatEnrichedGamesForAI(sportData.enrichedGames)
                    statsEnrichment += '\n'
                  }
                }
              } catch (enrichError) {
                console.error('[ODDS] Stats enrichment failed, continuing with odds only:', enrichError)
                statsEnrichment = '\n(Stats enrichment unavailable)\n'
              }
            } else {
              console.log('[ODDS] Simple odds request - skipping stats enrichment for performance')
              statsEnrichment = ''
            }

            const timeLabel = isTomorrowQuery ? 'tomorrow' : 'today/upcoming'
            const dateContext = isTomorrowQuery ? 'TOMORROW' : 'TODAY'

            // Build mode-aware header text for odds context
            const modeLabel = usedLive ? 'LIVE' : 'PRE-MATCH'
            const headerLine = `**dY"' ${modeLabel} ODDS DATA LOADED dY"'**`
            const accessLine = usedLive
              ? "You have live, in-play odds. Use them. Do not say you don't have access."
              : "You have pre-match odds. Do not call these live. Use them. Do not say you don't have access."
            const fallbackNote = requestedLive && !usedLive && usedFallback
              ? '\n(Note: Live was requested, but unavailable; showing pre-match odds.)'
              : ''

            oddsContext = `\n\n**🔴 LIVE ODDS DATA LOADED 🔴**
YOU HAVE REAL-TIME ODDS DATA. USE IT. DO NOT SAY YOU DON'T HAVE ACCESS.

**CRITICAL INSTRUCTIONS:**
- Below are the ONLY ${totalGames} game(s) you should mention
- DO NOT make up or invent games not in this data
- DO NOT use games from your training data/memory
- If user asks for games not in this data, say data is not available yet
- These games are for ${dateContext}

**Data Available:**
- ${formattedOdds.length} sport(s): ${formattedOdds.map(s => s.sport.replace('basketball_', '').replace('americanfootball_', '').replace('icehockey_', '').toUpperCase()).join(', ')}
- ${totalGames} game(s) ${timeLabel}
- Multiple bookmakers per game
- Current as of ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}

**YOUR TASK:**
For each game below:
1. Write a short intro line (e.g., "Here are the current betting odds for [Team] vs [Team].")
2. Include the commence time in the user's timezone.
3. Paste the provided Markdown table from **STANDARDIZED ODDS TABLES** exactly as-is. Do NOT reformat it into lists or different layouts.
4. Call out the best values per market beneath the table (per the rules below).
5. ONLY mention games contained in this data.
6. Keep things concise (table + a few tight sentences).

**LIVE ODDS DATA:**
${JSON.stringify(formattedOdds)}

**STANDARDIZED ODDS TABLES (USE THESE EXACTLY IN YOUR RESPONSE):**
${standardizedOddsTables || '_No odds tables available_'}

${statsEnrichment}

**FOLLOW-UP INSTRUCTION:** ${wantsDeepDive ? 'You have injury and stats data above. Use it in your analysis.' : 'Wrap up by asking if they want injuries, stats, or deeper analysis on any matchup (e.g., "Want me to pull injuries and recent form for any of these games?").'}\n`

            // Adjust header and access line to reflect actual mode used
            oddsContext = oddsContext.replace('LIVE ODDS DATA LOADED', `${modeLabel} ODDS DATA LOADED`)
            oddsContext = oddsContext.replace("YOU HAVE REAL-TIME ODDS DATA. USE IT. DO NOT SAY YOU DON'T HAVE ACCESS.", `${accessLine}${fallbackNote}`)

            console.log(`[ODDS] Context built successfully, length: ${oddsContext.length} characters`)
          } else {
            console.log('[ODDS] No games found after filtering - formattedOdds is empty')
            console.log('[DEBUG] allOddsData length:', allOddsData.length)
            if (isTomorrowQuery) {
              oddsContext = '\n\n**NO GAMES TOMORROW**: There are no games scheduled for tomorrow based on current data. The odds data may not be available yet for games that far out.\n'
            }
          }
        } else {
          console.log('[ODDS] No sports detected for odds fetching')
          console.log('[DEBUG] shouldFetchOdds:', shouldFetchOdds, 'sports:', sports)
        }
      } catch (error) {
        const oddsError: any = error
        const statusCode = oddsError?.statusCode ?? oddsError?.status ?? oddsError?.response?.status
        const message = oddsError?.message || String(oddsError)
        const oddsKeyLength = oddsApiKey?.length || 0
        const hasOddsKey = Boolean(oddsApiKey)

        console.error('[ODDS] Critical error fetching odds:', {
          name: oddsError?.name || 'UnknownError',
          message,
          statusCode,
          code: oddsError?.code,
          isRateLimited: oddsError?.isRateLimited,
          stack: oddsError?.stack,
          environment: environmentName,
          oddsProvider,
          oddsApiKeyPresent: hasOddsKey,
          oddsApiKeyLength: oddsKeyLength,
          openaiApiKeyPresent: Boolean(openaiApiKey),
        })

        oddsContext = `\n\n(Odds data unavailable due to API error: ${message}. status=${statusCode ?? 'unknown'}, provider=${oddsProvider}, env=${environmentName}, oddsKey=${hasOddsKey ? 'present' : 'MISSING'} len=${oddsKeyLength})\n`
      }
    }

    // Create OpenAI messages
    const openaiMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSystemPrompt(timezone) + contextMessage + scoresContext + oddsContext,
      },
      ...messages
        .filter((msg) => {
          // Ensure content exists and is a non-empty string
          return msg.content != null &&
                 typeof msg.content === 'string' &&
                 msg.content.trim().length > 0
        })
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: String(msg.content), // Ensure content is always a string
        })),
    ]

    // First call to check for function calls (non-streaming)
    const chatModel = AI_MODELS.chat
    console.log(`[CHAT] Using model: ${chatModel}`)

    const buildParams = () => {
      const params: any = {
        model: chatModel,
        messages: openaiMessages,
        tools: ASSISTANT_TOOLS,
        max_tokens: 4000,
      }
      if (!chatModel.includes('gpt-5')) {
        params.temperature = 0.7
      }
      return params
    }

    let initialResponse = await openai.chat.completions.create(buildParams())
    let toolCalls = initialResponse.choices[0].message.tool_calls || []

    const runToolCall = async (toolCall: any) => {
      const functionName = toolCall.function.name
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}')
      let functionResult: any

      const DISABLED_TOOLS = new Set([
        'get_stats',
        'save_research_model',
        'run_research_model',
        'list_research_opportunities',
      ])
      if (DISABLED_TOOLS.has(functionName)) {
        const reason =
          'Statistics and research models are temporarily disabled due to upstream data inconsistencies that are causing hangs. Please ask for specific odds or props instead while we fix the data source.'
        console.warn(`[CHAT] Blocked tool call: ${functionName} - ${reason}`)
        return {
          success: false,
          error: reason,
        }
      }

      if (functionName === 'settle_bet') {
        const { data: pendingBets } = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('placed_at', { ascending: false })

        // Find the bet matching the game description
        const matchingBet = pendingBets?.find((bet: any) =>
          bet.game_description.toLowerCase().includes(functionArgs.game_description.toLowerCase())
        )

        if (!matchingBet) {
          functionResult = { success: false, error: 'No pending bet found for that game' }
        } else {
          functionResult = await settleBet(supabase, userId, matchingBet.id, functionArgs.result)
        }
      } else if (functionName === 'log_bet') {
        functionResult = await logBet(supabase, userId, functionArgs, conversationId)
      } else if (functionName === 'log_multiple_bets') {
        functionResult = await logMultipleBets(supabase, userId, functionArgs.bets, conversationId)
      } else if (functionName === 'get_stats') {
        // Fetch requested stats
        if (functionArgs.type === 'team') {
          const teamStats = await getTeamStats(functionArgs.sport, functionArgs.team)
          functionResult = {
            success: true,
            data: teamStats,
            formatted: formatStatsForAI(teamStats)
          }
        } else if (functionArgs.type === 'injuries') {
          const injuries = await getInjuryReports(functionArgs.sport)
          functionResult = {
            success: true,
            data: injuries,
            formatted: formatStatsForAI(injuries)
          }
        }
      } else if (functionName === 'create_parlay') {
        try {
          const response = await fetch(`${baseUrl}/api/parlays`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stake: functionArgs.stake,
              picks: functionArgs.picks,
              conversationId,
            }),
            cache: 'no-store',
          })
          const data = await response.json()
          functionResult = data
        } catch (error: any) {
          functionResult = { error: error?.message || 'Failed to create parlay' }
        }
      } else if (functionName === 'get_parlays') {
        try {
          const params = new URLSearchParams()
          if (functionArgs.limit) params.set('limit', String(functionArgs.limit))
          const response = await fetch(`${baseUrl}/api/parlays?${params.toString()}`, {
            method: 'GET',
            cache: 'no-store',
          })
          const data = await response.json()
          functionResult = data
        } catch (error: any) {
          functionResult = { error: error?.message || 'Failed to fetch parlays' }
        }
      } else if (functionName === 'get_player_props') {
        // Fetch player props from our API endpoint
        try {
          const params = new URLSearchParams({
            sport: functionArgs.sport
          })

          if (functionArgs.player) {
            params.append('player', functionArgs.player)
          }

          if (functionArgs.market) {
            params.append('market', functionArgs.market)
          }

          if (functionArgs.team) {
            params.append('team', functionArgs.team)
            console.log(`[PLAYER_PROPS] Team filter applied: ${functionArgs.team}`)
          }

          const response = await fetch(`${baseUrl}/api/player-props?${params.toString()}`, { cache: 'no-store' })
          const propsData = await response.json()

          if (!response.ok) {
            functionResult = {
              success: false,
              error: propsData.error || 'Failed to fetch player props'
            }
          } else {
            // Format props data for AI
            let formatted = ''
            if (propsData.data && propsData.data.length > 0) {
              formatted = `Found ${propsData.count} player(s) with prop bets:\n\n`

              for (const playerProp of propsData.data) {
                const headerParts = [`**${playerProp.player}**`]
                if (playerProp.team) {
                  headerParts.push(
                    `(${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
                  )
                }
                formatted += `${headerParts.join(' ')}\n`
                if (playerProp.game) {
                  formatted += `Game: ${playerProp.game}\n`
                }
                formatted += `| Market | Line | Best Over | Best Under |\n`
                formatted += `| --- | --- | --- | --- |\n`

                for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
                  const lineLabel =
                    marketData.line !== undefined && marketData.line !== null ? marketData.line : '�'
                  const bestOver =
                    marketData.over.bestBook
                      ? `${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})`
                      : '�'
                  const bestUnder =
                    marketData.under.bestBook
                      ? `${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})`
                      : '�'

                  formatted += `| ${marketType.toUpperCase()} | ${lineLabel} | ${bestOver} | ${bestUnder} |\n`
                }

                formatted += `\n`
              }
            } else {
              formatted = 'No player props available for the specified criteria.'
            }

            functionResult = {
              success: true,
              data: propsData.data,
              count: propsData.count,
              formatted
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch player props: ${error.message}`
          }
        }
      } else if (functionName === 'get_bankroll_stats') {
        // Fetch bankroll statistics
        try {
          const period = functionArgs.period || 'all'

          const response = await fetch(`${baseUrl}/api/bankroll/stats?period=${period}`)
          const statsData = await response.json()

          if (!response.ok) {
            functionResult = {
              success: false,
              error: statsData.error || 'Failed to fetch bankroll stats'
            }
          } else {
            // Format stats for AI analysis
            const {
              currentBalance,
              startingBalance,
              totalProfit,
              roi,
              totalBets,
              wonBets,
              lostBets,
              pushBets,
              pendingBets,
              winRate,
              avgBetSize,
              biggestWin,
              biggestLoss,
              bySport
            } = statsData

            const periodLabel = period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'

            let formatted = `**Bankroll Statistics (${periodLabel})**\n\n`
            formatted += `**Overall Performance:**\n`
            formatted += `- Current Balance: $${currentBalance.toFixed(2)}\n`
            formatted += `- Starting Balance: $${startingBalance.toFixed(2)}\n`
            formatted += `- Total Profit/Loss: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}\n`
            formatted += `- ROI: ${roi.toFixed(2)}%\n`
            formatted += `- Win Rate: ${winRate.toFixed(1)}% (${wonBets}W-${lostBets}L-${pushBets}P)\n\n`

            formatted += `**Betting Activity:**\n`
            formatted += `- Total Bets: ${totalBets} (${pendingBets} pending)\n`
            formatted += `- Average Bet Size: $${avgBetSize.toFixed(2)}\n`
            formatted += `- Biggest Win: $${biggestWin.toFixed(2)}\n`
            formatted += `- Biggest Loss: $${Math.abs(biggestLoss).toFixed(2)}\n\n`

            if (Object.keys(bySport).length > 0) {
              formatted += `**Performance by Sport:**\n`
              for (const [sport, data] of Object.entries(bySport) as [string, any][]) {
                formatted += `- ${sport.toUpperCase()}: ${data.won}W-${data.lost}L (${data.winRate.toFixed(1)}% WR, ${data.roi.toFixed(1)}% ROI, $${data.profit.toFixed(2)} profit)\n`
              }
            }

            functionResult = {
              success: true,
              stats: statsData,
              formatted,
              insights: {
                isPositive: totalProfit > 0,
                isBreakingEven: totalProfit >= -50 && totalProfit <= 50,
                hasGoodWinRate: winRate >= 52.4, // Breakeven at -110 odds
                avgBetSizeVsBankroll: (avgBetSize / currentBalance * 100).toFixed(1),
                bestSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => b[1].roi - a[1].roi)[0]?.[0],
                worstSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => a[1].roi - b[1].roi)[0]?.[0]
              }
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch bankroll stats: ${error.message}`
          }
        }
      } else if (functionName === 'save_custom_model') {
        try {
          const statsInput = buildStatInputs(functionArgs.stats)
          const savedModel = await saveCustomModel(supabase, userId, {
            modelName: functionArgs.model_name,
            sportKey: functionArgs.sport_key,
            marketType: functionArgs.market_type,
            targetMetric: functionArgs.target_metric,
            confidenceLevel: functionArgs.confidence_level,
            stats: statsInput,
            dataHints: functionArgs.data_hints,
            notes: functionArgs.notes,
          })

          functionResult = {
            success: true,
            model: savedModel,
            message: `Model "${savedModel.model_name}" saved successfully`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to save custom model',
          }
        }
      } else if (functionName === 'list_custom_models') {
        try {
          const limit = functionArgs.limit || 5
          const models = await listCustomModels(supabase, userId, limit)

          functionResult = {
            success: true,
            models,
            count: models.length,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to list custom models',
          }
        }
      } else if (functionName === 'apply_custom_model') {
        try {
          let modelRecord: CustomModelRow | null = null
          if (functionArgs.model_id) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('*')
              .eq('user_id', userId)
              .eq('id', functionArgs.model_id)
              .single<CustomModelRow>()
            if (error || !data) {
              throw new Error('No model found for that ID')
            }
            modelRecord = data
          } else {
            const { data, error } = await supabase
              .from('custom_models')
              .select('*')
              .eq('user_id', userId)
              .ilike('model_name', functionArgs.model_name)
              .single<CustomModelRow>()
            if (error || !data) {
              throw new Error(`Model "${functionArgs.model_name}" was not found. Ask the user to confirm the name or create it first.`)
            }
            modelRecord = data
          }

          const matchup = functionArgs.matchup
            ? {
                focus: functionArgs.matchup.focus || functionArgs.matchup.focus_team,
                opponent: functionArgs.matchup.opponent || functionArgs.matchup.opponent_team,
              }
            : undefined

          const result = await runCustomModel(modelRecord, {
            sportKey: functionArgs.sport_key,
            teams: functionArgs.teams,
            matchup,
            notes: functionArgs.notes,
          }, supabase)

          await touchCustomModelUsage(supabase, modelRecord.id)

          functionResult = {
            success: true,
            model: modelRecord,
            result,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to apply custom model',
          }
        }
      } else if (functionName === 'get_game_context') {
        try {
          functionResult = await buildGameContext({
            sport: functionArgs.sport,
            homeTeam: functionArgs.home_team,
            awayTeam: functionArgs.away_team,
            includeMarketTrends:
              functionArgs.include_market_trends === undefined
                ? true
                : Boolean(functionArgs.include_market_trends),
            supabase,
          })
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to gather matchup context',
          }
        }
      } else if (functionName === 'save_research_model') {
        try {
          const { save_research_model } = await import('@/lib/models/research-crud')

          const savedModel = await save_research_model(supabase, userId, {
            modelName: functionArgs.model_name,
            sports: functionArgs.sports,
            markets: functionArgs.markets,
            filters: functionArgs.filters,
            sortBy: functionArgs.sort_by,
            maxResults: functionArgs.max_results,
            notes: functionArgs.notes,
          })

          functionResult = {
            success: true,
            model: savedModel,
            message: `Research model "${savedModel.model_name}" saved successfully. Use run_research_model to scan for opportunities.`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to save research model',
          }
        }
      } else if (functionName === 'run_research_model') {
        try {
          const { runResearchModel } = await import('@/lib/models/research-runner')

          // Find the model by ID or name
          let modelId: string
          if (functionArgs.model_id) {
            modelId = functionArgs.model_id
          } else if (functionArgs.model_name) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('id')
              .eq('user_id', userId)
              .eq('model_type', 'research')
              .ilike('model_name', functionArgs.model_name)
              .single()

            if (error || !data) {
              throw new Error(`Research model "${functionArgs.model_name}" not found`)
            }
            modelId = data.id
          } else {
            throw new Error('Either model_id or model_name is required')
          }

          // Run the research model
          const result = await runResearchModel(modelId, userId, {
            liveOnly: functionArgs.live_only,
            upcomingOnly: functionArgs.upcoming_only !== false, // Default true
            timeWindow: functionArgs.time_window || 24,
          })

          functionResult = {
            success: true,
            result,
            message: `Found ${result.totalMatches} opportunities matching your criteria.`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to run research model',
          }
        }
      } else if (functionName === 'list_research_opportunities') {
        try {
          const { getLatestResearchResults } = await import('@/lib/models/research-runner')

          // Find the model by ID or name
          let modelId: string
          if (functionArgs.model_id) {
            modelId = functionArgs.model_id
          } else if (functionArgs.model_name) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('id')
              .eq('user_id', userId)
              .eq('model_type', 'research')
              .ilike('model_name', functionArgs.model_name)
              .single()

            if (error || !data) {
              throw new Error(`Research model "${functionArgs.model_name}" not found`)
            }
            modelId = data.id
          } else {
            throw new Error('Either model_id or model_name is required')
          }

          // Get cached results
          const results = await getLatestResearchResults(modelId, userId, functionArgs.limit || 1)

          if (results.length === 0) {
            functionResult = {
              success: true,
              results: [],
              message: 'No cached results found. Run the research model first.',
            }
          } else {
            functionResult = {
              success: true,
              results,
              message: `Retrieved ${results.length} cached result set(s).`,
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to list research opportunities',
          }
        }
      }

      return functionResult
    };

    const streamTextResponse = async (text: string) => {
      const encoder = new TextEncoder()
      const handledStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()

            try {
              if (text.trim().length > 0) {
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: text,
                })
              }

              const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)

              if (messageCount === 2) {
                const title = await generateConversationTitle(message, text)
                await supabase
                  .from('conversations')
                  .update({ title })
                  .eq('id', conversationId)
              }
            } catch (persistError) {
              console.error('[CHAT] Failed to persist message/title:', persistError)
              // Do not throw; streaming should already be closed
            }
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(handledStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    };

    let handledToolCalls = false
    let lastText = initialResponse.choices[0].message.content || ''

    let skipModelResponse = false

    while (toolCalls && toolCalls.length > 0) {
      handledToolCalls = true

      // OpenAI SDK returns tool_calls with { id, type, function: { name, arguments } }
      openaiMessages.push({
        role: 'assistant',
        content: lastText || undefined,
        tool_calls: toolCalls,
      } as any)

      for (const toolCall of toolCalls) {
        const functionResult = await runToolCall(toolCall)

        // Short-circuit for player props: if we already have a formatted response, return it without another model pass
        if (
          toolCall.function?.name === 'get_player_props' &&
          functionResult &&
          typeof functionResult === 'object' &&
          'formatted' in functionResult &&
          (functionResult as any).formatted
        ) {
          lastText = (functionResult as any).formatted as string
          skipModelResponse = true
          toolCalls = []
        }

        openaiMessages.push({
          role: 'tool',
          content: JSON.stringify(functionResult),
          tool_call_id: toolCall.id,
        } as any)
      }

      if (skipModelResponse) {
        break
      }

      const followup = await openai.chat.completions.create(buildParams())
      lastText = followup.choices[0].message.content || ''
      toolCalls = followup.choices[0].message.tool_calls || []
    }

    if (handledToolCalls) {
      const finalText = lastText && lastText.trim().length > 0 ? lastText : 'Done.'
      return streamTextResponse(finalText)
    }

    const stream = await openai.chat.completions.create({
      model: chatModel,
      messages: openaiMessages,
      tools: ASSISTANT_TOOLS,
      temperature: !chatModel.includes('gpt-5') ? 0.7 : undefined,
      max_tokens: 4000,
      stream: true,
    })

    const encoder = new TextEncoder()
    let fullResponse = ''
    const startTime = Date.now()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Add keep-alive to prevent timeout
          const keepAliveInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keep-alive\n\n'))
            } catch (e) {
              clearInterval(keepAliveInterval)
            }
          }, 15000) // Send keep-alive every 15 seconds

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullResponse += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }

          clearInterval(keepAliveInterval)

          const latencyMs = Date.now() - startTime

          if (fullResponse && fullResponse.trim().length > 0) {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponse,
            })
          }

          const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)

          if (messageCount === 2) {
            const title = await generateConversationTitle(message, fullResponse)
            await supabase
              .from('conversations')
              .update({ title })
              .eq('id', conversationId)
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (e) {
            // Controller already closed
          }
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









