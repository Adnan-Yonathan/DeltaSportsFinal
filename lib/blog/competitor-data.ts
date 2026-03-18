export type ComparisonRow = {
  feature: string
  them: string
  delta: string
  deltaWins: boolean
}

export type CompetitorData = {
  slug: string
  name: string
  category: string
  primaryKeyword: string
  metaTitle: string
  metaDescription: string
  heroHeadline: string
  heroSubhead: string
  theirPitch: string
  theirPricing: string
  theirFocus: string
  weaknesses: string[]
  deltaAdvantages: string[]
  comparisonRows: ComparisonRow[]
  switchReasons: { title: string; body: string }[]
  verdict: string
}

export const COMPETITORS: CompetitorData[] = [
  {
    slug: 'oddsjam',
    name: 'OddsJam',
    category: 'Positive EV & odds comparison tool',
    primaryKeyword: 'OddsJam alternative',
    metaTitle: 'OddsJam Alternative | Delta Sports – Sharp Money First',
    metaDescription:
      'Looking for an OddsJam alternative? Delta Sports focuses on exchange orderbooks and sharp money tracking — not just no-vig EV. Compare features and pricing.',
    heroHeadline: 'Looking for an OddsJam alternative?',
    heroSubhead:
      'OddsJam is built around positive EV and no-vig odds. Delta is built around sharp money — exchange orderbooks, whale bets, and real market signals. Different tools for different edges.',
    theirPitch:
      'OddsJam is an odds comparison and positive EV tool that helps bettors find no-vig prices across books and identify EV opportunities from line discrepancies.',
    theirPricing: '$150–$250/month depending on plan',
    theirFocus: 'No-vig EV, odds comparison, arb betting',
    weaknesses: [
      'Expensive — $150–$250/month puts it out of reach for most bettors',
      'Focused on no-vig EV and arb, not sharp money or market structure',
      'No exchange orderbook reading — you see line discrepancies but not where the sharp money is actually sitting',
      'Limited whale/big bet detection — no feed of large exchange trades',
      'No market projection layer showing fair value vs current lines',
    ],
    deltaAdvantages: [
      'Exchange orderbook reading is the core product — see exactly where sharp money is resting',
      'Whale Feed tracks large bets hitting the tape in real time across Kalshi and Polymarket',
      'Sharp Projections surface model-driven edges between fair value and live lines',
      'Significantly cheaper — plans start at $24.99/week vs $150+/month',
      'Focused on following sharp money, not just line shopping for EV',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes — live feed', deltaWins: true },
      { feature: 'Sharp money signals', them: 'Limited (line movement only)', delta: 'Yes — orderbook + movement + splits', deltaWins: true },
      { feature: 'Positive EV / no-vig tool', them: 'Yes — primary feature', delta: 'Via market projections', deltaWins: false },
      { feature: 'Odds comparison across books', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Prop market orderbook depth', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Starting price', them: '$150/month', delta: '$24.99/week (~$79/month)', deltaWins: true },
      { feature: 'Free trial', them: 'Limited', delta: '7-day free trial', deltaWins: true },
    ],
    switchReasons: [
      {
        title: 'You want to follow sharp money, not just find no-vig lines',
        body: 'OddsJam excels at finding EV from book pricing discrepancies. Delta is built for bettors who want to see where sharp money is actually positioned — in exchange orderbooks, in large trades, in market structure.',
      },
      {
        title: 'You want to see the orderbook, not just the line',
        body: "Line discrepancies tell you there's a gap. Exchange orderbooks tell you why — and where the real money is sitting. Delta reads Kalshi, Novig, ProphetX, and Polymarket directly.",
      },
      {
        title: 'The price is too high for what you actually use',
        body: 'At $150–$250/month, OddsJam is a serious commitment. Delta starts at $24.99/week with a 7-day trial — so you can test whether sharp money tracking actually fits your process before paying.',
      },
    ],
    verdict:
      'If you bet heavy arb or pure no-vig EV, OddsJam is the established tool. If you want to follow sharp money through exchange orderbooks and real-time whale detection, Delta is built for that and costs significantly less.',
  },
  {
    slug: 'upside-tools',
    name: 'Upside Tools',
    category: 'Sharp money & sports betting analytics',
    primaryKeyword: 'Upside Tools alternative',
    metaTitle: 'Upside Tools Alternative | Delta Sports – Exchange Orderbooks + Whale Feed',
    metaDescription:
      'Looking for an Upside Tools alternative? Delta Sports reads exchange orderbooks and tracks whale bets in real time. Compare sharp money tools and pricing.',
    heroHeadline: 'Looking for an Upside Tools alternative?',
    heroSubhead:
      'Upside Tools covers sharp money tracking but treats it as one feature among many. Delta is built entirely around exchange orderbooks, whale bets, and market signals — at a fraction of the price.',
    theirPitch:
      'Upside Tools is a sports betting analytics platform covering sharp money signals, line movement, and betting trends across major US sports.',
    theirPricing: '$99–$199/month',
    theirFocus: 'Broad analytics platform with sharp money as one component',
    weaknesses: [
      'Sharp money tracking is a feature, not the core product — spread thin across many tools',
      'No exchange orderbook reading — misses where sharp money actually sits before books react',
      'Expensive relative to the depth of sharp-specific tooling',
      'No real-time whale bet detection from exchanges like Kalshi and Polymarket',
      'Broad platform means less depth on what actually matters for sharp bettors',
    ],
    deltaAdvantages: [
      'Exchange orderbooks are the primary data source — not lagging signals',
      'Whale Feed shows large individual bets hitting the tape in real time',
      'Sharp Props reads prop market orderbook depth across all major exchanges',
      'Built around one thing: finding where sharp money is',
      'Cheaper and more focused — not paying for features you will not use',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Real-time whale bet detection', them: 'No', delta: 'Yes — Kalshi + Polymarket', deltaWins: true },
      { feature: 'Sharp money as primary focus', them: 'No — one feature among many', delta: 'Yes — entire product', deltaWins: true },
      { feature: 'Prop orderbook depth', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Line movement tracking', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'Betting trends / splits', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Starting price', them: '$99/month', delta: '$24.99/week (~$79/month)', deltaWins: true },
      { feature: 'Free trial', them: 'Limited', delta: '7-day free trial', deltaWins: true },
    ],
    switchReasons: [
      {
        title: 'You want sharp money as the product, not a checkbox',
        body: 'Upside bundles sharp signals with a lot of other analytics. Delta is designed from the ground up for one thing: seeing where sharp money is. Orderbooks, whale prints, market structure — not line movement as an afterthought.',
      },
      {
        title: 'You want to read exchanges, not just watch lines move',
        body: 'Line movement is a lagging signal — it tells you sharps already moved. Exchange orderbooks show you where money is resting before it hits the books. Delta reads those orderbooks directly.',
      },
      {
        title: "You're paying for tools you don't use",
        body: 'Broad platforms charge for breadth. If you only care about sharp money signals, you are subsidizing features that do not improve your betting. Delta charges less and goes deeper on what matters.',
      },
    ],
    verdict:
      'Upside Tools is a capable broad analytics platform. Delta is the sharper, cheaper option if exchange orderbook reading and whale detection are what you actually want.',
  },
  {
    slug: 'action-network',
    name: 'Action Network',
    category: 'Sports betting media and picks platform',
    primaryKeyword: 'Action Network alternative',
    metaTitle: 'Action Network Alternative | Delta Sports – Real Sharp Money Tools',
    metaDescription:
      'Looking for an Action Network alternative? Delta Sports provides exchange orderbook data and sharp money signals — not picks or media content. Compare the two.',
    heroHeadline: 'Looking for an Action Network alternative?',
    heroSubhead:
      'Action Network is a media and picks platform built for the entertainment side of sports betting. Delta is a sharp money tool — exchange orderbooks, whale bets, and market data for bettors trying to win.',
    theirPitch:
      'Action Network is a sports betting media company offering picks, analysis, line tracking, and betting trends for recreational and serious bettors.',
    theirPricing: '$8–$20/month (media tier); PRO tier higher',
    theirFocus: 'Content, picks, trends, and entertainment',
    weaknesses: [
      'Media company first — picks and content, not sharp money tooling',
      'No exchange orderbook access — cannot see where sharp money is actually positioned',
      'Bet tracking is social/entertainment focused, not analytics-grade',
      'Sharp money signals are surface-level compared to exchange data',
      'No whale bet detection or real-time large trade feed',
    ],
    deltaAdvantages: [
      'Built for bettors trying to be profitable, not for entertainment or content consumption',
      'Exchange orderbook reading shows real sharp positioning before books react',
      'Whale Feed surfaces large individual bets from Kalshi and Polymarket',
      'No picks, no noise — just market data and signals',
      'Sharp Projections give model-driven fair value vs live lines',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Sharp money as core focus', them: 'No — content/media first', delta: 'Yes', deltaWins: true },
      { feature: 'Picks and expert analysis', them: 'Yes', delta: 'No', deltaWins: false },
      { feature: 'Line movement tracking', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'Bet splits / public money %', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Prop orderbook depth', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Free trial', them: 'Free tier available', delta: '7-day free trial', deltaWins: false },
    ],
    switchReasons: [
      {
        title: "You want data, not opinions",
        body: "Action Network's value is content — analysis, expert picks, community discussion. If you want to make your own decisions based on where sharp money is, you need market data, not media.",
      },
      {
        title: 'You want to learn how to win, not be told what to bet',
        body: 'Following picks is not a process. Delta shows you exchange orderbooks and sharp money signals so you can build a repeatable edge — one that works because you understand why, not just what.',
      },
      {
        title: 'You need sharper data than line movement and ticket splits',
        body: 'Action Network shows ticket percentages and line movement. Delta reads exchange orderbooks — where sharp money is actually resting before the books react. The signal quality is fundamentally different.',
      },
    ],
    verdict:
      'Action Network is a good product for bettors who want content, picks, and community. Delta is for bettors who want to follow real sharp money using exchange data and are trying to build a profitable long-term process.',
  },
  {
    slug: 'unabated',
    name: 'Unabated',
    category: 'Line shopping & CLV tracking platform',
    primaryKeyword: 'Unabated alternative',
    metaTitle: 'Unabated Alternative | Delta Sports – Exchange Orderbooks + Sharp Signals',
    metaDescription:
      'Looking for an Unabated alternative? Delta Sports goes beyond line shopping with exchange orderbook reading, whale detection, and sharp money tracking. Compare features.',
    heroHeadline: 'Looking for an Unabated alternative?',
    heroSubhead:
      'Unabated is a sharp line shopping and CLV tracking tool. Delta is built around exchange orderbooks, whale bets, and real-time sharp money signals — different layers of market intelligence.',
    theirPitch:
      'Unabated is a line shopping and closing line value tracking platform for serious sports bettors, offering no-vig lines, screen customization, and CLV analysis.',
    theirPricing: '$99–$149/month',
    theirFocus: 'Line shopping, no-vig calculation, CLV tracking',
    weaknesses: [
      'Focused on line shopping and CLV — does not read exchange orderbooks',
      'No real-time whale bet detection or large trade feed',
      'No exchange-level data showing where sharp money is actually resting',
      'Expensive for what is primarily a line comparison tool',
      'No AI-driven market projections or model-based fair value',
    ],
    deltaAdvantages: [
      'Exchange orderbook reading shows where sharp money is positioned before books react',
      'Whale Feed tracks large bets in real time across Kalshi and Polymarket',
      'Sharp Projections surface model-driven edges between fair value and live lines',
      'Insider Feed shows where proven profitable Polymarket wallets are betting',
      'More affordable — $79/month vs $99–$149/month with deeper sharp money data',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes — live feed', deltaWins: true },
      { feature: 'Line shopping across books', them: 'Yes — primary feature', delta: 'Yes', deltaWins: false },
      { feature: 'CLV tracking', them: 'Yes — primary feature', delta: 'Via projections', deltaWins: false },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Insider wallet tracking', them: 'No', delta: 'Yes — Polymarket wallets', deltaWins: true },
      { feature: 'Prop orderbook depth', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Starting price', them: '$99/month', delta: '$79/month', deltaWins: true },
      { feature: 'Free trial', them: 'Limited', delta: '3-day free trial', deltaWins: true },
    ],
    switchReasons: [
      {
        title: 'You want to see where sharp money is, not just where lines differ',
        body: 'Unabated excels at finding the best number across books. Delta shows you why lines are moving — exchange orderbooks reveal where sharp money is resting before books adjust.',
      },
      {
        title: 'You want whale detection and insider tracking',
        body: 'Unabated does not track large individual bets or Polymarket wallet activity. Delta surfaces whale prints and insider positions from proven profitable wallets in real time.',
      },
      {
        title: 'You want model-driven projections, not just line comparisons',
        body: 'Line shopping finds the best available number. Sharp Projections tell you what the number should be — so you know whether the best available line actually has value.',
      },
    ],
    verdict:
      'Unabated is a strong line shopping and CLV tool for disciplined bettors. Delta adds exchange orderbook depth, whale detection, and insider tracking on top — a deeper layer of sharp money intelligence at a lower price point.',
  },
  {
    slug: 'outlier-bet',
    name: 'Outlier.bet',
    category: 'AI-powered sports betting predictions',
    primaryKeyword: 'Outlier bet alternative',
    metaTitle: 'Outlier.bet Alternative | Delta Sports – Real Market Data Over AI Predictions',
    metaDescription:
      'Looking for an Outlier.bet alternative? Delta Sports tracks real sharp money through exchange orderbooks and whale bets instead of AI predictions. Compare approaches.',
    heroHeadline: 'Looking for an Outlier.bet alternative?',
    heroSubhead:
      'Outlier.bet uses AI models to predict outcomes. Delta tracks where real sharp money is positioned — exchange orderbooks, whale bets, and insider wallets. Models guess. Markets show.',
    theirPitch:
      'Outlier.bet is an AI-powered sports betting platform that uses machine learning models to generate predictions and identify value across major sports.',
    theirPricing: '$49–$99/month',
    theirFocus: 'AI predictions, model-driven picks, statistical projections',
    weaknesses: [
      'AI predictions are model outputs — they do not reflect where real money is positioned',
      'No exchange orderbook data showing actual sharp money flow',
      'No whale bet detection or large trade visibility',
      'Model-based approach has no edge over books that use similar or better models',
      'No transparency into which wallets or bettors are driving market moves',
    ],
    deltaAdvantages: [
      'Exchange orderbooks show where real sharp money sits — not model predictions',
      'Whale Feed tracks actual large bets, not predicted outcomes',
      'Insider Feed reveals where proven profitable Polymarket wallets are betting',
      'Sharp Projections combine model output with real market signals',
      'Market data reflects what smart money is actually doing, not what a model thinks will happen',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes — live feed', deltaWins: true },
      { feature: 'AI/model predictions', them: 'Yes — primary feature', delta: 'Yes — combined with market data', deltaWins: true },
      { feature: 'Insider wallet tracking', them: 'No', delta: 'Yes — Polymarket wallets', deltaWins: true },
      { feature: 'Real sharp money signals', them: 'No — model-derived', delta: 'Yes — exchange + movement + splits', deltaWins: true },
      { feature: 'Line movement tracking', them: 'Limited', delta: 'Yes', deltaWins: true },
      { feature: 'Prop market depth', them: 'Limited', delta: 'Yes — orderbook depth', deltaWins: true },
      { feature: 'Starting price', them: '$49/month', delta: '$79/month', deltaWins: false },
      { feature: 'Free trial', them: 'Limited', delta: '3-day free trial', deltaWins: true },
    ],
    switchReasons: [
      {
        title: 'You want to follow real money, not model predictions',
        body: 'AI models predict what might happen. Exchange orderbooks show you where real money is positioned right now. Delta gives you the market signal, not a guess.',
      },
      {
        title: 'You want transparency into who is betting, not just what to bet',
        body: 'Outlier gives you a prediction. Delta shows you which whales hit a line, which insider wallets are positioned, and where the orderbook has depth — so you understand why, not just what.',
      },
      {
        title: 'Models cannot beat the market consistently — but following sharp money can',
        body: 'Sportsbooks use sophisticated models too. The edge is not in building a better model — it is in seeing where proven winners are putting their money before the market adjusts.',
      },
    ],
    verdict:
      'Outlier.bet is a solid AI prediction tool. Delta takes a fundamentally different approach — tracking real sharp money flow through exchanges instead of relying on model outputs. If you believe markets are smarter than models, Delta is the sharper choice.',
  },
  {
    slug: 'propgpt',
    name: 'PropGPT',
    category: 'AI-powered player prop predictions',
    primaryKeyword: 'PropGPT alternative',
    metaTitle: 'PropGPT Alternative | Delta Sports – Exchange Orderbook Props, Not AI Picks',
    metaDescription:
      'Looking for a PropGPT alternative? Delta Sports reads prop exchange orderbooks and tracks where sharp money sits on player props — not AI-generated predictions.',
    heroHeadline: 'Looking for a PropGPT alternative?',
    heroSubhead:
      'PropGPT generates AI predictions on player props. Delta reads the actual exchange orderbook — showing you where real sharp money is positioned on props before books adjust.',
    theirPitch:
      'PropGPT is an AI-powered player prop prediction tool that uses machine learning to generate over/under predictions for player statistical categories across major sports.',
    theirPricing: '$29–$79/month',
    theirFocus: 'AI-generated player prop predictions',
    weaknesses: [
      'AI predictions on props with no visibility into actual market positioning',
      'No exchange orderbook data — cannot see where sharp money sits on props',
      'No context on why a prop might be mispriced (injury, lineup, sharp action)',
      'Model outputs compete with sportsbook models that have more data',
      'No whale or insider tracking on prop markets',
    ],
    deltaAdvantages: [
      'Sharp Props reads exchange orderbook depth for player props across Kalshi, Novig, and ProphetX',
      'See where sharp money is actually resting on props — not a model guess',
      'Whale Feed surfaces large prop bets hitting the tape',
      'Best available price comparison across books and exchanges',
      'Market data shows real supply and demand, not a model prediction',
    ],
    comparisonRows: [
      { feature: 'Prop exchange orderbook depth', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'AI prop predictions', them: 'Yes — primary feature', delta: 'Via projections + market data', deltaWins: true },
      { feature: 'Whale bet detection on props', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Sharp side indicator on props', them: 'No — model only', delta: 'Yes — exchange-derived', deltaWins: true },
      { feature: 'Best available prop price', them: 'Limited', delta: 'Yes — across books + exchanges', deltaWins: true },
      { feature: 'Game-level sharp signals', them: 'No — props only', delta: 'Yes — full market coverage', deltaWins: true },
      { feature: 'Insider wallet tracking', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Starting price', them: '$29/month', delta: '$79/month', deltaWins: false },
      { feature: 'Free trial', them: 'Limited', delta: '3-day free trial', deltaWins: true },
    ],
    switchReasons: [
      {
        title: 'You want to see real sharp positioning on props, not AI guesses',
        body: 'PropGPT runs a model and gives you a number. Delta reads the exchange orderbook and shows you where sharp money is actually positioned on that prop — depth, side pressure, and wall concentration.',
      },
      {
        title: 'You want full market coverage, not just props',
        body: 'PropGPT only covers player props. Delta covers props, spreads, totals, and moneylines with exchange orderbook data, sharp signals, whale detection, and insider tracking across every market.',
      },
      {
        title: 'Exchange data is a better signal than a model prediction',
        body: 'Sportsbooks already use AI models to price props. The edge is not in having a slightly different model — it is in seeing where proven sharp bettors are putting real money on those props.',
      },
    ],
    verdict:
      'PropGPT is a cheap entry point for AI prop predictions. Delta is the upgrade — exchange orderbook depth on props, whale detection, and sharp side signals based on real money flow instead of model outputs.',
  },
  {
    slug: 'sharp-app',
    name: 'SharpApp',
    category: 'Sharp betting signals app',
    primaryKeyword: 'SharpApp alternative',
    metaTitle: 'SharpApp Alternative | Delta Sports – Deeper Sharp Money Through Exchange Data',
    metaDescription:
      'Looking for a SharpApp alternative? Delta Sports provides exchange orderbook data, whale detection, and insider tracking — deeper sharp money intelligence.',
    heroHeadline: 'Looking for a SharpApp alternative?',
    heroSubhead:
      'SharpApp surfaces sharp money signals from line movement and splits. Delta goes deeper — reading exchange orderbooks directly and tracking whale bets and insider wallets in real time.',
    theirPitch:
      'SharpApp is a mobile-first sports betting analytics app that surfaces sharp money signals, line movement alerts, and betting trends to help bettors follow professional action.',
    theirPricing: '$19–$49/month',
    theirFocus: 'Sharp money alerts, line movement, mobile-first experience',
    weaknesses: [
      'Sharp signals derived from line movement and splits — lagging indicators',
      'No exchange orderbook data showing where money is actually resting',
      'No whale bet detection or large trade feed',
      'Mobile-first approach limits depth of analysis possible',
      'No insider wallet tracking or exchange-level market intelligence',
    ],
    deltaAdvantages: [
      'Exchange orderbooks show sharp positioning before lines move — leading indicator',
      'Whale Feed detects large individual bets hitting the tape in real time',
      'Insider Feed tracks proven profitable Polymarket wallets',
      'Sharp Props reads orderbook depth across Kalshi, Novig, and ProphetX',
      'Full desktop and mobile experience with deeper analytical tools',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes — live feed', deltaWins: true },
      { feature: 'Sharp money alerts', them: 'Yes — primary feature', delta: 'Yes — exchange-derived', deltaWins: true },
      { feature: 'Line movement tracking', them: 'Yes', delta: 'Yes', deltaWins: false },
      { feature: 'Insider wallet tracking', them: 'No', delta: 'Yes — Polymarket wallets', deltaWins: true },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Prop orderbook depth', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Starting price', them: '$19/month', delta: '$79/month', deltaWins: false },
      { feature: 'Free trial', them: 'Free tier available', delta: '3-day free trial', deltaWins: false },
    ],
    switchReasons: [
      {
        title: 'You want leading indicators, not lagging signals',
        body: 'SharpApp alerts you when lines have already moved. Exchange orderbooks show you where money is resting before the books react. Delta gives you the signal earlier.',
      },
      {
        title: 'You want to see who is betting, not just that someone did',
        body: 'SharpApp tells you sharp money moved a line. Delta shows you which whales hit the tape, which insider wallets are positioned, and what the orderbook depth looks like.',
      },
      {
        title: 'You want depth of analysis over convenience',
        body: 'SharpApp is simple and mobile-first. Delta provides more analytical depth — exchange orderbooks, prop market depth, insider tracking — for bettors who want to go deeper.',
      },
    ],
    verdict:
      'SharpApp is an accessible entry point for sharp money signals. Delta is the more powerful tool — exchange orderbook reading, whale detection, and insider tracking provide a deeper layer of market intelligence for bettors ready to upgrade.',
  },
  {
    slug: 'pikkit',
    name: 'Pikkit',
    category: 'Sports betting tracking and analytics',
    primaryKeyword: 'Pikkit alternative',
    metaTitle: 'Pikkit Alternative | Delta Sports – Sharp Money Tools, Not Bet Tracking',
    metaDescription:
      'Looking for a Pikkit alternative? Delta Sports provides exchange orderbook data and sharp money signals for finding edge — not just tracking past bets.',
    heroHeadline: 'Looking for a Pikkit alternative?',
    heroSubhead:
      'Pikkit helps you track your bets and see community trends. Delta helps you find better bets — exchange orderbooks, whale detection, and sharp money signals that surface real edge before you place a wager.',
    theirPitch:
      'Pikkit is a social sports betting app for bet tracking, community picks, and performance analytics — designed to help bettors understand their own betting patterns.',
    theirPricing: 'Free / Premium tiers',
    theirFocus: 'Bet tracking, community picks, social betting',
    weaknesses: [
      'Bet tracking is backward-looking — tells you what happened, not where edge is now',
      'Community picks are unverified — no sharp money validation',
      'No exchange orderbook data or real-time market signals',
      'Social features prioritize engagement over profitable betting',
      'No whale detection, insider tracking, or exchange-level intelligence',
    ],
    deltaAdvantages: [
      'Forward-looking: exchange orderbooks and sharp signals help you find edge before betting',
      'Whale Feed and Insider Feed surface real money from verified profitable bettors',
      'Sharp Projections show model-driven fair value vs live lines',
      'No social noise — pure market data and signals for serious bettors',
      'Exchange-level data that community picks and bet tracking cannot provide',
    ],
    comparisonRows: [
      { feature: 'Exchange orderbook reading', them: 'No', delta: 'Yes — core feature', deltaWins: true },
      { feature: 'Whale / big bet detection', them: 'No', delta: 'Yes — live feed', deltaWins: true },
      { feature: 'Bet tracking', them: 'Yes — primary feature', delta: 'Basic tracking', deltaWins: false },
      { feature: 'Community / social features', them: 'Yes — primary feature', delta: 'No', deltaWins: false },
      { feature: 'Sharp money signals', them: 'No', delta: 'Yes — exchange-derived', deltaWins: true },
      { feature: 'AI market projections', them: 'No', delta: 'Yes', deltaWins: true },
      { feature: 'Insider wallet tracking', them: 'No', delta: 'Yes — Polymarket wallets', deltaWins: true },
      { feature: 'Starting price', them: 'Free', delta: '$79/month', deltaWins: false },
      { feature: 'Free trial', them: 'Free tier', delta: '3-day free trial', deltaWins: false },
    ],
    switchReasons: [
      {
        title: 'You want to find edge, not just track results',
        body: 'Pikkit tells you how your past bets performed. Delta helps you find better bets going forward — exchange orderbooks, whale prints, and sharp signals surface where real money is positioned.',
      },
      {
        title: 'You want verified sharp money, not community consensus',
        body: 'Community picks reflect public sentiment. Delta tracks whale bets and insider wallets with verified profitable track records — the signal quality is fundamentally different.',
      },
      {
        title: 'You are ready to invest in tools that help you win',
        body: 'Pikkit is free because bet tracking and social features do not require expensive data. Exchange orderbook reading, whale detection, and insider tracking cost real money to build — and provide a real edge.',
      },
    ],
    verdict:
      'Pikkit is a good free tool for tracking bets and following community activity. Delta is a different category entirely — sharp money tools built around exchange data for bettors focused on finding profitable edge, not tracking past results.',
  },
]

export const getCompetitorBySlug = (slug: string) =>
  COMPETITORS.find((c) => c.slug === slug)
