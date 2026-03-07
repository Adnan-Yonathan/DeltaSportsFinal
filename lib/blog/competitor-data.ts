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
]

export const getCompetitorBySlug = (slug: string) =>
  COMPETITORS.find((c) => c.slug === slug)
