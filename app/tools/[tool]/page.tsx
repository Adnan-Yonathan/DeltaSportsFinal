import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { SimpleHeader } from '@/components/ui/simple-header'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { CORE_TOOLS, CORE_TOOLS_BY_KEY, type CoreToolKey } from '@/lib/core-tools'
import { ArrowRight } from 'lucide-react'
import { ToolVibePreview } from '@/components/tools/tool-vibe-preview'
import { ToolTutorialOverlay } from '@/components/tools/tool-tutorial-overlay'
import { PricingSection } from '@/components/ui/pricing-section'
import { PRICING_TIERS } from '@/components/pricing/pricing-tiers'

export const dynamic = 'force-static'

type PageProps = {
  params: { tool: string }
}

type GuideCallout = {
  title: string
  body: string
}

type GuideLongTermStep = {
  title: string
  body: string
}

type ToolGuideConfig = {
  guideLabel: string
  heroTitle: string
  heroDescription: string
  screenshotTitle: string
  screenshotSrc: string
  screenshotAlt: string
  callouts: [GuideCallout, GuideCallout, GuideCallout]
  longTermTitle: string
  longTermIntro: string
  longTermSteps: GuideLongTermStep[]
  ctaTitle: string
  ctaDescription: string
  ctaPrimaryLabel: string
}

function isCoreToolKey(value: string): value is CoreToolKey {
  return value in CORE_TOOLS_BY_KEY
}

const TOOL_GUIDE_CONFIGS: Partial<Record<CoreToolKey, ToolGuideConfig>> = {
  'sharp-props': {
    guideLabel: 'Sharp Props Guide',
    heroTitle: 'Turn prop market noise into clear, actionable bets.',
    heroDescription:
      'See where sharp money is actually sitting, lock in better prices before the board moves, and place props with a process instead of guesswork.',
    screenshotTitle: 'Read the prop board like a sharp',
    screenshotSrc: '/Screenshot%202026-03-02%20015116.png',
    screenshotAlt: 'Sharp Props interface showing liquidity and recommended betting side.',
    callouts: [
      {
        title: 'Whale Volume',
        body: 'Total notional behind the signal, so you can gauge how much capital is backing this setup.',
      },
      {
        title: 'Sharp Books Live Odds',
        body: 'Compare current prices across sharp books in one row and instantly spot stale numbers.',
      },
      {
        title: 'Recommended Side Liquidity',
        body: 'Shows resting liquidity on the recommended side only, so you follow where sharp money is positioned.',
      },
    ],
    longTermTitle: 'How to use Sharp Props for long-term profit',
    longTermIntro:
      'Treat Sharp Props as a price-quality filter, not an auto-bet feed. Long-term edge comes from disciplined selection, timing, and staking.',
    longTermSteps: [
      {
        title: '1. Filter for real liquidity and stable markets',
        body: 'Start with props that show meaningful resting liquidity on the recommended side. Skip thin markets where one small order can distort the read.',
      },
      {
        title: '2. Compare sharp-book price before entering',
        body: 'Use the live odds strip to confirm you are getting one of the best available prices. Do not chase if the best number is already gone.',
      },
      {
        title: '3. Track closing value by prop type',
        body: 'Log your entry odds and compare to close. Over time, keep only prop archetypes where you consistently beat close.',
      },
      {
        title: '4. Stake by tiered confidence, not emotion',
        body: 'Use fixed units and scale only when liquidity, price quality, and signal alignment all agree. Consistent sizing protects bankroll variance.',
      },
    ],
    ctaTitle: 'Ready to follow sharp props with confidence?',
    ctaDescription:
      'Open Sharp Props and use liquidity, side pressure, and best available odds in one flow.',
    ctaPrimaryLabel: 'Open Sharp Props',
  },
  'sharp-projections': {
    guideLabel: 'Sharp Projections Guide',
    heroTitle: 'Attack stale numbers before the market fully catches up.',
    heroDescription:
      'Scan projected edges against live lines, rank the best value quickly, and route your action into the highest-quality opportunities first.',
    screenshotTitle: 'Find the best projected edges in seconds',
    screenshotSrc: '/sharpprojections.png',
    screenshotAlt: 'Sharp Projections table showing ranked market edges and line context.',
    callouts: [
      {
        title: 'Edge Ranking',
        body: 'Top edges are sorted so you can prioritize the highest-value lines first.',
      },
      {
        title: 'Market Context',
        body: 'Each row shows current line context so you can compare fair value vs the live number.',
      },
      {
        title: 'Execution Focus',
        body: 'Use the board to quickly shortlist which bets deserve immediate attention.',
      },
    ],
    longTermTitle: 'How to use Sharp Projections for long-term profit',
    longTermIntro:
      'Sharp Projections should drive your daily decision queue. The goal is to repeatedly capture mispriced lines before market correction.',
    longTermSteps: [
      {
        title: '1. Build your card from top-ranked edges only',
        body: 'Start each session by selecting a narrow list of highest-quality edges. Avoid diluting edge by adding low-conviction plays.',
      },
      {
        title: '2. Prioritize markets with cleaner execution',
        body: 'Favor lines where you can consistently get near-top pricing. A smaller model edge with reliable execution often outperforms bigger but unreachable edges.',
      },
      {
        title: '3. Monitor line movement against your entry',
        body: 'Review whether your numbers move toward your position after entry. This helps validate signal quality and timing.',
      },
      {
        title: '4. Review performance by league and market',
        body: 'Segment results by sport, market type, and edge bucket. Reallocate volume toward segments where CLV and ROI persist.',
      },
    ],
    ctaTitle: 'Ready to hit the best numbers faster?',
    ctaDescription:
      'Open Sharp Projections and work from ranked edges instead of manually scanning every market.',
    ctaPrimaryLabel: 'Open Sharp Projections',
  },
  'whale-feed': {
    guideLabel: 'Whale Feed Guide',
    heroTitle: 'Track respected money as it hits the tape.',
    heroDescription:
      'See large bets, clustering, and market context in one feed so you can identify where sharp pressure is building in real time.',
    screenshotTitle: 'Track where the biggest money is moving now',
    screenshotSrc: '/whalefeed.png',
    screenshotAlt: 'Whale Feed showing large bets, filters, and grouped market activity.',
    callouts: [
      {
        title: 'Volume Snapshot',
        body: 'Top metrics show total volume, detected sharps, and live bet activity at a glance.',
      },
      {
        title: 'Hot Games Grouping',
        body: 'Cluster mode groups pressure by game so you can see where money is concentrated.',
      },
      {
        title: 'Trade Details',
        body: 'Each card includes market, timestamp, and stake context for faster decision making.',
      },
    ],
    longTermTitle: 'How to use Whale Feed for long-term profit',
    longTermIntro:
      'Whale Feed is best used as a confirmation and timing engine. Long-term gains come from reading pressure early, then being selective.',
    longTermSteps: [
      {
        title: '1. Focus on repeated pressure, not single prints',
        body: 'One large trade can be noise. Multiple aligned prints in the same market are stronger evidence of informed positioning.',
      },
      {
        title: '2. Use Hot Games to find concentrated action',
        body: 'When activity clusters in one game, treat it as a priority research candidate rather than blindly tailing every trade.',
      },
      {
        title: '3. Check price drift after whale activity',
        body: 'If the market moves in the same direction after large trades, signal quality is stronger. If not, reduce confidence and size.',
      },
      {
        title: '4. Pair with projections or research before entry',
        body: 'Use Whale Feed for direction and urgency, then validate with another tool for value and context to reduce false positives.',
      },
    ],
    ctaTitle: 'Ready to follow real-time whale pressure?',
    ctaDescription:
      'Open Whale Feed and track where respected capital is flowing before the broader market reacts.',
    ctaPrimaryLabel: 'Open Whale Feed',
  },
  'research-mode': {
    guideLabel: 'Research Mode Guide',
    heroTitle: 'Understand why the market moved, not just where it moved.',
    heroDescription:
      'Break down sharp signals, line behavior, and market structure so every bet is backed by explainable context.',
    screenshotTitle: 'Break down the market thesis with evidence',
    screenshotSrc: '/research.png',
    screenshotAlt: 'Research Mode analysis view with line panels and signal breakdown.',
    callouts: [
      {
        title: 'Analytical Summary',
        body: 'Get a plain-language read on the strongest signal and why sharps may be leaning that side.',
      },
      {
        title: 'Line Panels',
        body: 'Track spread, total, and moneyline behavior together to understand market structure.',
      },
      {
        title: 'Signal Breakdown',
        body: 'See tagged factors behind the move so your thesis is evidence-based before entering.',
      },
    ],
    longTermTitle: 'How to use Research Mode for long-term profit',
    longTermIntro:
      'Research Mode compounds edge by improving decision quality over time. Use it to validate thesis strength and eliminate weak setups.',
    longTermSteps: [
      {
        title: '1. Start with a clear hypothesis per game',
        body: 'Define what you think is mispriced, then use the analysis panels to test whether market behavior supports that view.',
      },
      {
        title: '2. Validate with multi-signal agreement',
        body: 'Higher-confidence opportunities show agreement across movement, summary context, and signal tags. Avoid forcing one-signal bets.',
      },
      {
        title: '3. Document why you entered each bet',
        body: 'Store the key thesis drivers from Research Mode at entry. This creates structured feedback loops for post-bet review.',
      },
      {
        title: '4. Cut patterns that fail under review',
        body: 'If a recurring setup underperforms despite similar context, downgrade or remove it. Long-term profit requires pruning weak systems.',
      },
    ],
    ctaTitle: 'Ready to bet with deeper market context?',
    ctaDescription:
      'Open Research Mode and validate your thesis with structured signal breakdowns before you fire.',
    ctaPrimaryLabel: 'Open Research Mode',
  },
}

export function generateStaticParams() {
  return CORE_TOOLS.map((tool) => ({ tool: tool.key }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const key = params.tool
  if (!isCoreToolKey(key)) return { title: 'Tool not found' }
  const tool = CORE_TOOLS_BY_KEY[key]
  return {
    title: `${tool.label} | Delta Tools`,
    description: tool.summary,
  }
}

export default function ToolDetailPage({ params }: PageProps) {
  const key = params.tool
  if (!isCoreToolKey(key)) notFound()
  const tool = CORE_TOOLS_BY_KEY[key]

  const guideConfig = TOOL_GUIDE_CONFIGS[tool.key]
  if (guideConfig) {
    const [leftCallout, rightTopCallout, rightBottomCallout] = guideConfig.callouts

    return (
      <div className="relative min-h-screen bg-black text-white">
        <OddsMatrixSurface intensity={0.38} className="opacity-90" />

        <SimpleHeader widthClass="max-w-6xl" />

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:pt-20">
          <header className="rounded-3xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-200/80">
              {guideConfig.guideLabel}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {guideConfig.heroTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm text-white/75 sm:text-base">
              {guideConfig.heroDescription}
            </p>

          </header>

          <section className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur sm:p-6">
            <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">
              {guideConfig.screenshotTitle}
            </h2>
            <div className="relative mx-auto mt-5 max-w-[620px]">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#020810]">
                <Image
                  src={guideConfig.screenshotSrc}
                  alt={guideConfig.screenshotAlt}
                  width={1920}
                  height={1080}
                  className="h-auto w-full"
                  priority
                />
              </div>

              <div className="hidden lg:block">
                <div className="absolute -left-48 top-6 z-20 w-40 rounded-xl border border-emerald-300/30 bg-black/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                    {leftCallout.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/80">
                    {leftCallout.body}
                  </p>
                  <span className="pointer-events-none absolute -right-10 top-1/2 h-px w-10 bg-emerald-300/70" />
                  <span className="pointer-events-none absolute -right-[15px] top-[calc(50%-4px)] h-0 w-0 border-y-4 border-l-6 border-y-transparent border-l-emerald-300/90" />
                </div>

                <div className="absolute -right-48 top-20 z-20 w-40 rounded-xl border border-emerald-300/30 bg-black/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                    {rightTopCallout.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/80">
                    {rightTopCallout.body}
                  </p>
                  <span className="pointer-events-none absolute -left-10 top-1/2 h-px w-10 bg-emerald-300/70" />
                  <span className="pointer-events-none absolute -left-[15px] top-[calc(50%-4px)] h-0 w-0 border-y-4 border-r-6 border-y-transparent border-r-emerald-300/90" />
                </div>

                <div className="absolute -right-48 top-[255px] z-20 w-40 rounded-xl border border-emerald-300/30 bg-black/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                    {rightBottomCallout.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/80">
                    {rightBottomCallout.body}
                  </p>
                  <span className="pointer-events-none absolute -left-10 top-1/2 h-px w-10 bg-emerald-300/70" />
                  <span className="pointer-events-none absolute -left-[15px] top-[calc(50%-4px)] h-0 w-0 border-y-4 border-r-6 border-y-transparent border-r-emerald-300/90" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
                {guideConfig.callouts.map((callout) => (
                  <div key={callout.title} className="rounded-xl border border-emerald-300/25 bg-black/85 p-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                      {callout.title}
                    </p>
                    <p className="mt-2 text-xs text-white/80">{callout.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <PricingSection tiers={PRICING_TIERS} className="bg-transparent" />
          </section>

          <section className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur sm:p-8">
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
              {guideConfig.longTermTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-white/70">
              {guideConfig.longTermIntro}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {guideConfig.longTermSteps.map((step) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-black/55 p-4"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center shadow-[0_16px_50px_rgba(16,185,129,0.16)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-emerald-200/85">
              Start now
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {guideConfig.ctaTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/75 sm:text-base">
              {guideConfig.ctaDescription}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={tool.productRoute}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-emerald-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-black hover:bg-emerald-300"
              >
                {guideConfig.ctaPrimaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 hover:border-emerald-400/50 hover:text-emerald-200"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>
        <ToolTutorialOverlay toolKey={tool.key} />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.38} className="opacity-90" />

      <SimpleHeader widthClass="max-w-6xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:pt-24">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 text-center backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Tool Guide
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {tool.label}
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            {tool.summary}
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={tool.productRoute}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-emerald-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-black shadow-[0_16px_50px_rgba(16,185,129,0.25)] hover:bg-emerald-300 sm:w-auto"
            >
              <span>Open tool</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 hover:border-emerald-400/50 hover:text-emerald-200 sm:w-auto"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                What you get
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {tool.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300/80 shadow-[0_0_16px_rgba(52,211,153,0.45)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                  Insider move
                </p>
                <p className="mt-2 text-sm text-white/70">
                  Start here, then confirm with another tool before you commit.
                  Delta is built to compound signals.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/55 backdrop-blur">
              <div className="relative aspect-[16/9] w-full">
                <div className="absolute inset-0 p-4 sm:p-5">
                  <ToolVibePreview toolKey={tool.key} className="h-full w-full" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              </div>
              <div className="p-5 text-xs text-white/55">
                Tip: click <span className="text-emerald-200">Open tool</span> above
                to see it live.
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            href="/tools"
            className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/70 hover:border-emerald-400/50 hover:text-emerald-200"
          >
            Back to tools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
      <ToolTutorialOverlay toolKey={tool.key} />
    </div>
  )
}
