import type { CoreToolKey } from '@/lib/core-tools'

export type SeoBlogTopic = {
  slug: string
  primaryKeyword: string
  title: string
  topic: string
  metaDescription: string
  relatedToolKeys?: CoreToolKey[]
}

export const SEO_BLOG_TOPICS: SeoBlogTopic[] = [
  // --- Cluster 1: Core sharp money (existing) ---
  {
    slug: 'sharp-money-sports-betting',
    primaryKeyword: 'sharp money sports betting',
    title: 'Sharp Money Sports Betting: How to Follow Real Market Signals',
    topic:
      'Explain how sharp money works, how to identify it in real time, and how bettors can build a repeatable process around it.',
    metaDescription:
      'Sharp money sports betting explained with real examples, market signals, and a step-by-step process serious bettors can use.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-projections'],
  },
  {
    slug: 'reverse-line-movement-betting',
    primaryKeyword: 'reverse line movement betting',
    title: 'Reverse Line Movement Betting: Read the Market Like a Pro',
    topic:
      'Teach reverse line movement from basics to advanced reads and show how to avoid false positives.',
    metaDescription:
      'Reverse line movement betting guide: how to spot true steam, avoid traps, and use movement with context to improve decisions.',
    relatedToolKeys: ['research-mode', 'sharp-projections'],
  },
  {
    slug: 'sharp-money-tracker',
    primaryKeyword: 'sharp money tracker',
    title: 'Sharp Money Tracker: What to Track, When to Fade, and When to Follow',
    topic:
      'Show bettors how to use a sharp money tracker, rank signals by quality, and turn signals into disciplined long-term decisions.',
    metaDescription:
      'Sharp money tracker strategy for long-term bettors: signal scoring, practical workflows, and examples with real betting scenarios.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-projections'],
  },

  // --- Cluster 2: Glossary (definitional) ---
  {
    slug: 'what-is-clv-betting',
    primaryKeyword: 'CLV betting',
    title: 'CLV Betting: What Closing Line Value Is and Why It Predicts Long-Term Profit',
    topic:
      'Define closing line value (CLV), explain why it is the gold standard metric for sharp bettors, show how to calculate it, and give practical examples of how to use CLV to evaluate your own betting.',
    metaDescription:
      'CLV betting explained: what closing line value means, why sharps obsess over it, and how to use it to measure whether your betting process actually has edge.',
    relatedToolKeys: ['research-mode', 'sharp-projections'],
  },
  {
    slug: 'what-is-a-sharp-bettor',
    primaryKeyword: 'what is a sharp bettor',
    title: 'What Is a Sharp Bettor? How Sharps Think, Bet, and Win Long-Term',
    topic:
      'Define what a sharp bettor is, contrast sharps with recreational bettors, explain how sharps approach line shopping, CLV, bankroll management, and market reading — and show what separates a genuine sharp process from casual betting.',
    metaDescription:
      'What is a sharp bettor? Learn how sharps actually win long-term — their process, mindset, and tools — and what separates them from recreational bettors.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-projections'],
  },
  {
    slug: 'what-is-a-steam-move',
    primaryKeyword: 'steam move betting',
    title: 'Steam Moves in Sports Betting: What They Are and How to Spot Them',
    topic:
      'Explain what a steam move is, how coordinated sharp action triggers rapid line movement across books, how to distinguish real steam from public overreaction, and what to do when you spot one.',
    metaDescription:
      'Steam move betting explained: what happens when sharps hit a line, how books respond, and how to identify genuine steam vs. public noise.',
    relatedToolKeys: ['sharp-money-feed', 'research-mode'],
  },
  {
    slug: 'what-is-line-shopping',
    primaryKeyword: 'line shopping sports betting',
    title: 'Line Shopping in Sports Betting: How Getting the Best Number Compounds Over Time',
    topic:
      'Explain line shopping — comparing odds across sportsbooks to find the best number — show the long-run mathematical impact of consistently getting half-point or better prices, and give a practical workflow for doing it efficiently.',
    metaDescription:
      'Line shopping sports betting guide: why a half-point difference matters, how to compare books fast, and how getting the best number is one of the highest-ROI habits a bettor can build.',
    relatedToolKeys: ['sharp-projections', 'sharp-props'],
  },
  {
    slug: 'what-is-a-betting-exchange',
    primaryKeyword: 'betting exchange explained',
    title: 'Betting Exchanges Explained: Kalshi, Novig, ProphetX, and Polymarket',
    topic:
      'Explain what a betting exchange is, how it differs from a sportsbook, why exchanges matter for sharp bettors (true market prices, orderbook transparency, no limits), and give a practical overview of Kalshi, Novig, ProphetX, and Polymarket.',
    metaDescription:
      'Betting exchanges explained: what they are, how they differ from books, and why sharp bettors use Kalshi, Novig, ProphetX, and Polymarket to find real market prices.',
    relatedToolKeys: ['sharp-props', 'sharp-money-feed'],
  },
  {
    slug: 'positive-ev-betting',
    primaryKeyword: 'positive EV betting',
    title: 'Positive EV Betting: The Only Sports Betting Strategy That Wins Long-Term',
    topic:
      'Define expected value in betting, explain why positive EV is the only mathematically sound long-term strategy, contrast it with picking winners, show how to calculate EV from odds and fair probability, and explain how sharp money and market signals help identify +EV spots.',
    metaDescription:
      'Positive EV betting explained: what expected value means, how to find +EV bets, and why it is the only strategy that produces long-term profit in sports betting.',
    relatedToolKeys: ['sharp-projections', 'sharp-props'],
  },
  {
    slug: 'sharp-vs-square-money',
    primaryKeyword: 'sharp money vs square money',
    title: 'Sharp Money vs Square Money: How to Read Betting Market Signals',
    topic:
      'Explain the difference between sharp (professional) and square (recreational) money, how sportsbooks price and move lines differently in response to each, what signals indicate sharp vs square action, and how bettors can use this to filter noise from real market information.',
    metaDescription:
      'Sharp money vs square money: how to tell the difference, why it matters for line movement, and how to use betting market signals to find real edge.',
    relatedToolKeys: ['sharp-money-feed', 'research-mode'],
  },
  {
    slug: 'expected-value-sports-betting',
    primaryKeyword: 'expected value sports betting',
    title: 'Expected Value in Sports Betting: How to Calculate and Apply It',
    topic:
      'Teach expected value from first principles for sports bettors — the formula, how to convert odds to implied probability, how to estimate fair probability, and how to apply EV thinking across spreads, totals, and props with practical examples.',
    metaDescription:
      'Expected value sports betting guide: the EV formula, how to calculate it for any bet, and how to use it to make decisions that produce profit over the long run.',
    relatedToolKeys: ['sharp-projections', 'sharp-props'],
  },

  // --- Cluster 3: How-to (process) ---
  {
    slug: 'how-to-follow-sharp-money',
    primaryKeyword: 'how to follow sharp money',
    title: 'How to Follow Sharp Money: A Step-by-Step System for Serious Bettors',
    topic:
      'Give a concrete, actionable workflow for following sharp money: where to find signals (exchanges, line movement, bet splits), how to rank signal quality, when to follow vs fade, and how to build this into a repeatable daily process.',
    metaDescription:
      'How to follow sharp money in sports betting: a step-by-step system using exchange data, line movement, and bet splits to find and act on real sharp signals.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-projections'],
  },
  {
    slug: 'how-to-read-line-movement',
    primaryKeyword: 'how to read line movement',
    title: 'How to Read Line Movement in Sports Betting',
    topic:
      'Teach bettors how to interpret line movement — what causes lines to move, the difference between sharp-driven and public-driven movement, how to use opening vs closing line comparison, and how to apply this analysis before placing a bet.',
    metaDescription:
      'How to read line movement in sports betting: what moves lines, how to tell sharp from public action, and how to use movement data to make better betting decisions.',
    relatedToolKeys: ['research-mode', 'sharp-projections'],
  },
  {
    slug: 'how-to-beat-the-closing-line',
    primaryKeyword: 'beat the closing line betting',
    title: 'How to Beat the Closing Line: The Bettor\'s Edge That Actually Scales',
    topic:
      'Explain why beating the closing line is the primary indicator of a +EV betting process, give a practical strategy for consistently getting better numbers than close (timing, line shopping, exchange prices), and show how to track your own CLV over time.',
    metaDescription:
      'How to beat the closing line in sports betting: why CLV matters, how to get better numbers than close consistently, and how to track whether your process has real edge.',
    relatedToolKeys: ['sharp-projections', 'research-mode'],
  },
  {
    slug: 'how-to-find-sharp-bets',
    primaryKeyword: 'how to find sharp bets',
    title: 'How to Find Sharp Bets: A Repeatable Daily Process',
    topic:
      'Give a clear daily workflow for finding sharp bets: scanning exchange orderbooks, monitoring line movement, checking reverse line movement signals, using bet splits to filter public noise, and prioritizing the highest-quality spots.',
    metaDescription:
      'How to find sharp bets: a daily process using exchange orderbooks, line movement, and bet splits to surface high-quality spots before the market corrects.',
    relatedToolKeys: ['sharp-projections', 'sharp-money-feed'],
  },
  {
    slug: 'sports-betting-bankroll-management',
    primaryKeyword: 'sports betting bankroll management',
    title: 'Sports Betting Bankroll Management: How Sharps Size Their Bets',
    topic:
      'Explain bankroll management for sharp bettors — flat betting vs Kelly criterion, unit sizing, how to handle variance, why proper sizing is as important as finding edge, and practical guidelines for bettors at different bankroll levels.',
    metaDescription:
      'Sports betting bankroll management guide: how sharps size bets, when to use Kelly criterion, and how to protect your bankroll while maximizing long-term growth.',
    relatedToolKeys: ['sharp-projections', 'research-mode'],
  },
  {
    slug: 'how-to-use-betting-exchanges',
    primaryKeyword: 'how to use betting exchanges',
    title: 'How to Use Betting Exchanges: A Sharp Bettor\'s Guide',
    topic:
      'Walk through how to use betting exchanges as a sharp bettor — reading orderbooks, understanding bid/ask spreads, identifying where large money is resting, using exchange prices as a market signal, and the key differences between US exchanges like Kalshi and Novig.',
    metaDescription:
      'How to use betting exchanges: read orderbooks, find where sharp money is resting, and use Kalshi, Novig, and ProphetX as a market signal for better betting decisions.',
    relatedToolKeys: ['sharp-props', 'sharp-money-feed'],
  },
  {
    slug: 'how-to-bet-player-props',
    primaryKeyword: 'how to bet player props sharp',
    title: 'How to Bet Player Props the Sharp Way: Liquidity, Prices, and Process',
    topic:
      'Explain a sharp approach to player props — why props are beatable, how to use exchange liquidity to identify where sharp money sits, how to line shop props across books, what role injury news and lineup data plays, and how to build a repeatable prop betting process.',
    metaDescription:
      'How to bet player props the sharp way: use exchange liquidity, line shop across books, and build a process that finds profitable props before lines adjust.',
    relatedToolKeys: ['sharp-props', 'sharp-money-feed'],
  },

  // --- Cluster 4: Sport-specific ---
  {
    slug: 'sharp-money-nba-betting',
    primaryKeyword: 'sharp money NBA betting',
    title: 'Sharp Money NBA Betting: How the Best NBA Bettors Find Edge',
    topic:
      'Explain how sharp money moves in NBA markets specifically — pace of line movement, how exchange orderbooks behave in NBA props, the role of injury news, back-to-back scheduling, rest edges, and what a sharp NBA betting process looks like day-to-day.',
    metaDescription:
      'Sharp money NBA betting: how sharps approach the NBA, where edge comes from, and how to use exchange data and line movement to find profitable spots in basketball markets.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-props'],
  },
  {
    slug: 'sharp-money-nfl-betting',
    primaryKeyword: 'sharp money NFL betting',
    title: 'Sharp Money NFL Betting: Reading the Market in Football',
    topic:
      'Explain how sharp money behaves in NFL markets — the weekly line release cycle, how books react to sharp action on totals vs spreads, the importance of line shopping in NFL, how exchange data applies to football betting, and what the best NFL bettors look for.',
    metaDescription:
      'Sharp money NFL betting guide: how lines move with sharp action in football, where to find edge in NFL markets, and how to use exchange data and line movement week to week.',
    relatedToolKeys: ['sharp-money-feed', 'sharp-projections'],
  },
  {
    slug: 'sharp-props-nba',
    primaryKeyword: 'sharp props NBA',
    title: 'Sharp Props NBA: How to Find Profitable NBA Player Props Using Exchange Data',
    topic:
      'Walk through a sharp approach to NBA player props specifically — how exchange orderbooks reveal where sharp money is positioned on points/rebounds/assists/threes, how to read liquidity walls, how injury and lineup news interacts with prop pricing, and a repeatable workflow for sharp NBA prop betting.',
    metaDescription:
      'Sharp props NBA guide: use exchange orderbook liquidity, sharp side pressure, and best available prices to find profitable NBA player props before lines move.',
    relatedToolKeys: ['sharp-props', 'sharp-money-feed'],
  },
]

export const DEFAULT_GAME_PRIMARY_KEYWORD = 'sharp money sports betting'

export const getSeoBlogTopicBySlug = (slug: string) =>
  SEO_BLOG_TOPICS.find((topic) => topic.slug === slug)

