'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  ChartNoAxesCombined,
  DollarSign,
  Eye,
  FlaskConical,
  Loader2,
  Lock,
  Search,
  Shield,
  Target,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import {
  EXPERIENCE_DISPLAY_NAMES,
  GOAL_DISPLAY_NAMES,
  ROI_PLAN_COST,
  TOOL_DISPLAY_NAMES,
  TRIAL_ONBOARDING_STORAGE_KEY,
  calculateRoiSnapshot,
  createDefaultTrialOnboardingDraft,
  getExperienceResponse,
  isTrialExperience,
  isTrialGoalKey,
  prioritizeTools,
  trackTrialFlowEvent,
  type RecommendedToolKey,
  type TrialExperience,
  type TrialGoalKey,
  type TrialOnboardingDraft,
} from '@/lib/trial-flow'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenId =
  | 'welcome'
  | 'name'
  | 'experience'
  | 'goals'
  | 'projections'
  | 'props'
  | 'whale'
  | 'research'
  | 'roi'
  | 'final'

// ─── Screen registry ──────────────────────────────────────────────────────────

const SCREENS: Array<{ id: ScreenId; label: string; progress: number; cta: string }> = [
  { id: 'welcome',     label: 'Welcome',      progress: 0,   cta: "Let's get started →" },
  { id: 'name',        label: 'Step 1 of 10', progress: 10,  cta: 'Continue →' },
  { id: 'experience',  label: 'Step 2 of 10', progress: 20,  cta: 'Continue →' },
  { id: 'goals',       label: 'Step 3 of 10', progress: 30,  cta: 'Continue →' },
  { id: 'projections', label: 'Step 4 of 10', progress: 40,  cta: 'Next tool →' },
  { id: 'props',       label: 'Step 5 of 10', progress: 50,  cta: 'Next tool →' },
  { id: 'whale',       label: 'Step 6 of 10', progress: 60,  cta: 'Next tool →' },
  { id: 'research',    label: 'Step 7 of 10', progress: 70,  cta: 'Calculate my edge →' },
  { id: 'roi',         label: 'Step 8 of 10', progress: 80,  cta: 'See what I get →' },
  { id: 'final',       label: 'Step 10 of 10', progress: 100, cta: 'Start my free trial →' },
]

// ─── Sync draft to sessionStorage ────────────────────────────────────────────

function syncDraft(draft: TrialOnboardingDraft) {
  try {
    sessionStorage.setItem(TRIAL_ONBOARDING_STORAGE_KEY, JSON.stringify(draft))
  } catch {}
}

// ─── Primitive: animated counter ─────────────────────────────────────────────

function AnimatedCounter({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1200,
}: {
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const steps = Math.ceil(duration / 16)
    let i = 0
    const timer = setInterval(() => {
      i++
      setVal(parseFloat(((to * i) / steps).toFixed(decimals)))
      if (i >= steps) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [to, duration, decimals])
  return <>{prefix}{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString()}{suffix}</>
}

// ─── Primitive: pill badge ────────────────────────────────────────────────────

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
      {children}
    </span>
  )
}

// ─── Primitive: info callout ──────────────────────────────────────────────────

function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4 text-sm leading-relaxed text-emerald-200/80">
      {children}
    </div>
  )
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function ScreenWelcome({ rm }: { rm: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Live alert row */}
      <motion.div
        initial={rm ? {} : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
      >
        <span className="ob-live-dot" />
        <span className="text-xs text-white/55">
          <span className="font-semibold text-emerald-300">$74,000</span>
          {' '}just hit the Lakers over · 3 min ago
        </span>
      </motion.div>

      {/* Headline */}
      <motion.div
        initial={rm ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h1 className="text-3xl font-black leading-[1.08] tracking-[-0.03em] text-white">
          Stop guessing.{' '}
          <span className="text-emerald-300">
            Bet with the sharps.
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          2 minutes from signals that move lines — before the public sees them.
        </p>
      </motion.div>

      {/* Stat cards */}
      <motion.div
        initial={rm ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { value: 9.8, decimals: 1, prefix: '+', suffix: '%', label: 'Avg CLV' },
          { value: 1240, decimals: 0, suffix: '', label: 'Verified picks' },
          { value: 1000, decimals: 0, suffix: '+', label: 'Active members' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={rm ? {} : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.28 + i * 0.07 }}
            className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center"
          >
            <div className="text-lg font-black text-emerald-300">
              <AnimatedCounter to={stat.value} decimals={stat.decimals} prefix={stat.prefix} suffix={stat.suffix} />
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-white/35">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Trust line */}
      <motion.p
        initial={rm ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-white/30"
      >
        2 min setup · no card required yet
      </motion.p>
    </div>
  )
}

// ─── Screen: Name ─────────────────────────────────────────────────────────────

function ScreenName({
  draft,
  onName,
  rm,
}: {
  draft: TrialOnboardingDraft
  onName: (v: string) => void
  rm: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white">What should we call you?</h2>
        <p className="mt-1.5 text-sm text-white/50">Used to personalize your setup and signals throughout.</p>
      </div>

      {/* Name input */}
      <div className="relative">
        <input
          autoFocus
          enterKeyHint="next"
          type="text"
          value={draft.name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Your first name"
          className="w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/25 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/20 transition-all"
        />
        {draft.name.trim().length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400"
          >
            <Check className="h-3 w-3 text-black" />
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-white/28">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        Your data is never sold or shared
      </div>
    </div>
  )
}

// ─── Screen: Experience ───────────────────────────────────────────────────────

const EXP_OPTIONS: Array<{
  id: TrialExperience
  emoji: string
  label: string
  desc: string
  config: string[]
}> = [
  {
    id: 'casual-fan',
    emoji: '🎲',
    label: 'Just getting started',
    desc: 'Casual fan looking to find an edge',
    config: ['Guided projections with plain-English context', 'Simplified signal view', 'Step-by-step workflow tips'],
  },
  {
    id: 'recreational',
    emoji: '⚡',
    label: 'Play for fun, want an edge',
    desc: 'Recreational bettor building habits',
    config: ['Ranked board view surfaced first', 'Key signals without data overload', 'Prop lean scoring enabled'],
  },
  {
    id: 'serious-bettor',
    emoji: '🎯',
    label: 'Process-driven, track results',
    desc: 'Serious bettor with a system',
    config: ['Edge-ranked projections as default', 'Sharper board context shown', 'CLV tracking on by default'],
  },
  {
    id: 'sharp-pro',
    emoji: '🔬',
    label: 'Data-first, CLV focused',
    desc: 'Sharp/pro bettor, model-driven',
    config: ['Raw model data surfaced first', 'Exchange pricing prioritized', 'Full backtest history unlocked'],
  },
]

function ScreenExperience({
  draft,
  onSelect,
  rm,
}: {
  draft: TrialOnboardingDraft
  onSelect: (v: TrialExperience) => void
  rm: boolean
}) {
  const selected = EXP_OPTIONS.find((o) => o.id === draft.experienceLevel)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          {draft.name ? `${draft.name.split(' ')[0]}, how do you bet?` : 'How do you bet?'}
        </h2>
        <p className="mt-1.5 text-sm text-white/50">Delta configures your setup based on your level.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {EXP_OPTIONS.map((opt) => {
          const isSelected = draft.experienceLevel === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={cn(
                'relative rounded-2xl border p-3.5 text-left transition-all',
                isSelected
                  ? 'border-emerald-400/40 bg-emerald-400/8'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/18'
              )}
            >
              {isSelected && (
                <div className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400">
                  <Check className="h-2.5 w-2.5 text-black" />
                </div>
              )}
              <div className="text-xl">{opt.emoji}</div>
              <div className={cn('mt-2 text-sm font-bold leading-tight', isSelected ? 'text-white' : 'text-white/75')}>
                {opt.label}
              </div>
              <div className="mt-0.5 text-[10px] text-white/38">{opt.desc}</div>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={rm ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <InfoCallout>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/70">
                Delta configures for you:
              </div>
              <ul className="space-y-1.5">
                {selected.config.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="text-xs text-white/65">{item}</span>
                  </li>
                ))}
              </ul>
            </InfoCallout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Screen: Goals ────────────────────────────────────────────────────────────

const GOAL_OPTIONS: Array<{ id: TrialGoalKey; icon: ReactNode; label: string }> = [
  { id: 'beat-the-book',       icon: <Target className="h-4 w-4" />,    label: 'Beat the book' },
  { id: 'find-sharp-lines',    icon: <TrendingUp className="h-4 w-4" />, label: 'Find sharp lines before they move' },
  { id: 'track-whale-activity',icon: <DollarSign className="h-4 w-4" />, label: 'Track big money / whale activity' },
  { id: 'validate-picks',      icon: <BarChart3 className="h-4 w-4" />,  label: 'Validate picks with CLV' },
]

const TOOL_ICONS: Record<RecommendedToolKey, ReactNode> = {
  'sharp-projections': <ChartNoAxesCombined className="h-3.5 w-3.5" />,
  'sharp-props': <Activity className="h-3.5 w-3.5" />,
  'whale-detector': <Waves className="h-3.5 w-3.5" />,
  'insider-feed': <Eye className="h-3.5 w-3.5" />,
  'research-mode': <FlaskConical className="h-3.5 w-3.5" />,
}

const WORKFLOW_STEPS: Record<TrialGoalKey, Array<{ step: string; tool: string }>> = {
  'beat-the-book': [
    { step: 'Find market mispricing', tool: 'Sharp Projections' },
    { step: 'Confirm edge strength', tool: 'Research Mode' },
    { step: 'Bet before adjustment', tool: 'Live boards' },
  ],
  'find-sharp-lines': [
    { step: 'Scan edge-ranked board', tool: 'Sharp Projections' },
    { step: 'Track steam moves', tool: 'Whale Feed' },
    { step: 'Lock in before move', tool: 'Line shopping' },
  ],
  'track-whale-activity': [
    { step: 'Watch $50K+ tickets', tool: 'Whale Feed' },
    { step: 'Read prop pressure', tool: 'Sharp Props' },
    { step: 'Confirm with projections', tool: 'Sharp Projections' },
  ],
  'validate-picks': [
    { step: 'Check CLV history', tool: 'Research Mode' },
    { step: 'Confirm edge exists', tool: 'Sharp Projections' },
    { step: 'Size based on confidence', tool: 'All tools' },
  ],
}

function ScreenGoals({
  draft,
  onToggle,
  rm,
}: {
  draft: TrialOnboardingDraft
  onToggle: (v: TrialGoalKey) => void
  rm: boolean
}) {
  const primaryGoal = draft.goals[0] ?? null
  const workflow = primaryGoal ? WORKFLOW_STEPS[primaryGoal] : null
  const tools = draft.prioritizedTools

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white">What are you here for?</h2>
        <p className="mt-1.5 text-sm text-white/50">Select all that apply. We'll build your workflow around this.</p>
      </div>

      <div className="flex flex-col gap-2">
        {GOAL_OPTIONS.map((opt, i) => {
          const isSelected = draft.goals.includes(opt.id)
          return (
            <motion.button
              key={opt.id}
              initial={rm ? {} : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => onToggle(opt.id)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all',
                isSelected
                  ? 'border-emerald-400/40 bg-emerald-400/8'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/18'
              )}
            >
              <div className={cn('shrink-0', isSelected ? 'text-emerald-300' : 'text-white/35')}>
                {opt.icon}
              </div>
              <span className={cn('flex-1 text-sm font-semibold', isSelected ? 'text-white' : 'text-white/60')}>
                {opt.label}
              </span>
              <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-white/15 bg-transparent'
              )}>
                {isSelected && <Check className="h-3 w-3 text-black" />}
              </div>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {draft.goals.length > 0 && workflow && (
          <motion.div
            key={primaryGoal}
            initial={rm ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
          >
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
              Your recommended workflow
            </p>
            <div className="flex items-start gap-0">
              {workflow.map((item, i) => (
                <div key={item.step} className="flex flex-1 flex-col items-center text-center">
                  <div className="flex w-full items-center">
                    <div className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : 'bg-emerald-400/25')} />
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-400/12 text-xs font-bold text-emerald-300">
                      {i + 1}
                    </div>
                    <div className={cn('h-px flex-1', i === workflow.length - 1 ? 'bg-transparent' : 'bg-emerald-400/25')} />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold leading-tight text-white/75">{item.step}</p>
                  <p className="mt-0.5 text-[9px] text-emerald-300/60">{item.tool}</p>
                </div>
              ))}
            </div>

            {tools.length > 0 && (
              <div className="mt-3 border-t border-white/6 pt-3">
                <p className="mb-2 text-[9px] uppercase tracking-[0.2em] text-white/28">Tool priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((tool, i) => (
                    <div key={tool} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                      <span className={cn('text-[11px]', i === 0 ? 'text-emerald-300' : 'text-white/35')}>
                        {TOOL_ICONS[tool]}
                      </span>
                      <span className={cn('text-[10px] font-medium', i === 0 ? 'text-white/80' : 'text-white/35')}>
                        {i === 0 && '★ '}{TOOL_DISPLAY_NAMES[tool]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Shared mockup card ────────────────────────────────────────────────────────

function MockupShell({
  badge,
  liveDot,
  children,
}: {
  badge: string
  liveDot?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#030c0a] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.5)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.35em] text-white/25">Live tool preview</span>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/22 bg-emerald-400/9 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">
          {liveDot && <span className="ob-live-dot" style={{ width: 6, height: 6, minWidth: 6 }} />}
          {badge}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Screen: Sharp Projections ────────────────────────────────────────────────

const PROJ_ROWS = [
  { game: 'Knicks vs Heat', market: 'Spread', edge: '+5.2', line: 'NYK -6.5', hot: true,
    expand: 'Delta model: NYK -4.1 · Market: -6.5 · Gap: 2.4 pts — model says Knicks are undervalued.' },
  { game: 'Lakers vs Celtics', market: 'Total', edge: '+3.8', line: 'Over 224.5', hot: false,
    expand: 'Combined pace model: 228.1 implied · Market: 224.5 · 3.6pt misprice on totals.' },
  { game: 'Bills vs Chiefs', market: 'Moneyline', edge: '+2.7', line: 'KC -148', hot: false,
    expand: 'Win probability model: KC 58.2% · Implied by -148: 59.7% · Slight overvalue on Chiefs.' },
]

function ScreenProjections({ draft, rm }: { draft: TrialOnboardingDraft; rm: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const isSharp = draft.experienceLevel === 'sharp-pro' || draft.experienceLevel === 'serious-bettor'

  const primaryGoal = draft.goals[0]
  const goalContext: Record<string, string> = {
    'beat-the-book': 'This is your primary tool — surface mispricings before the market corrects.',
    'find-sharp-lines': 'Scan this board first. Sharp line moves start here.',
    'track-whale-activity': 'Use this to confirm whale bets are backed by model edge.',
    'validate-picks': 'Cross-reference your picks here before placing.',
  }
  const contextLine = primaryGoal ? goalContext[primaryGoal] : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Pill>Step 4 of 10</Pill>
          <ChartNoAxesCombined className="h-4 w-4 text-emerald-300" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Sharp Projections</h2>
        <p className="mt-1.5 text-sm text-white/50">
          {contextLine ?? 'Edge-ranked board refreshing every 15 min. Tap a row to see the edge breakdown.'}
        </p>
      </div>

      <MockupShell badge="LIVE"  liveDot>
        <div className="space-y-2">
          {PROJ_ROWS.map((row, i) => (
            <motion.div
              key={row.game}
              initial={rm ? {} : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + i * 0.09 }}
            >
              <button
                onClick={() => setExpanded(expanded === row.game ? null : row.game)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
                  row.hot ? 'border-emerald-300/22 bg-emerald-400/7' : 'border-white/7 bg-black/20'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{row.game}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/35">{row.market}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">{row.edge}</span>
                    <div className="mt-0.5 text-[10px] text-white/38">{row.line}</div>
                  </div>
                </div>
                <AnimatePresence>
                  {expanded === row.game && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 border-t border-white/8 pt-2 text-[11px] leading-relaxed text-white/50">
                        {row.expand}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Spread gap', 'Total misprice', 'Model consensus'].map((p) => (
            <span key={p} className="rounded-full border border-emerald-300/15 bg-emerald-400/7 px-2 py-0.5 text-[10px] text-emerald-200/65">{p}</span>
          ))}
        </div>
      </MockupShell>

      <InfoCallout>
        {isSharp
          ? 'Edge value = delta between Delta model price and live market. Positive = market hasn\'t corrected yet. Negative edge rows are hidden by default.'
          : 'Green edge badges mean Delta\'s model disagrees with the current line. The higher the number, the bigger the gap — those surface first.'}
      </InfoCallout>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: '+9.8%', l: 'Avg CLV' },
          { v: '15 min', l: 'Refresh' },
          { v: '3', l: 'Core markets' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/8 bg-white/[0.02] py-2.5">
            <div className="text-sm font-black text-emerald-300">{s.v}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/32">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Screen: Sharp Props ──────────────────────────────────────────────────────

const PROP_ROWS = [
  { player: 'N. Jokić',    line: 'O 26.5 pts', pct: 81, edge: '+3.4', side: 'Over',
    expand: 'Exchange depth heavy on Over side since 9:40 AM. Wall concentration at 26.5 across FanDuel + DK.' },
  { player: 'S. Curry',    line: 'O 28.5 pts', pct: 78, edge: '+2.9', side: 'Over',
    expand: 'Orderbook showing 78% lean on Over. Books slow to adjust from opening number.' },
  { player: 'L. James',    line: 'O 24.5 pts', pct: 62, edge: '+1.6', side: 'Over',
    expand: 'Moderate lean. Matchup-adjusted projection: 26.2 pts. Line opened at 23.5 — already moved once.' },
]

function ScreenProps({ draft, rm }: { draft: TrialOnboardingDraft; rm: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const betSize = draft.betSize || 100
  const projProfit = ((betSize * (100 / 110)) * 3 * 0.78).toFixed(0)

  const primaryGoal = draft.goals[0]
  const propsContext: Record<string, string> = {
    'beat-the-book': 'Props market moves faster — orderbook pressure shows mispricing before spread adjustments.',
    'find-sharp-lines': 'Sharp prop action often precedes game-line moves. Watch the lean scores.',
    'track-whale-activity': 'Large-ticket activity hits props first. This feed shows exactly who is leaning and why.',
    'validate-picks': 'Run your prop picks against orderbook lean to validate before placing.',
  }
  const contextLine = primaryGoal ? propsContext[primaryGoal] : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Pill>Step 5 of 10</Pill>
          <Activity className="h-4 w-4 text-emerald-400/60" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Sharp Props</h2>
        <p className="mt-1.5 text-sm text-white/50">
          {contextLine ?? 'Orderbook lean before books adjust. Tap a row to see the reasoning.'}
        </p>
      </div>

      <MockupShell badge="SHARP">
        <div className="space-y-2.5">
          {PROP_ROWS.map((row, i) => (
            <motion.div
              key={row.player}
              initial={rm ? {} : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + i * 0.1 }}
            >
              <button
                onClick={() => setExpanded(expanded === row.player ? null : row.player)}
                className="w-full rounded-xl border border-white/7 bg-black/20 p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{row.player}</div>
                    <div className="mt-0.5 text-xs text-white/45">{row.line}</div>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">{row.edge}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/32">
                  <span>{row.side} lean</span>
                  <span className="font-semibold text-white/60">{row.pct}%</span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${row.pct}%` }}
                    transition={rm ? {} : { duration: 0.8, ease: 'easeOut', delay: 0.2 + i * 0.1 }}
                    className="h-full rounded-full bg-emerald-400"
                    style={{ boxShadow: '0 0 4px rgba(52,211,153,0.4)' }}
                  />
                </div>
                <AnimatePresence>
                  {expanded === row.player && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 border-t border-white/8 pt-2 text-[11px] leading-relaxed text-white/50">
                        {row.expand}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
      </MockupShell>

      <InfoCallout>
        <span className="font-semibold text-emerald-200">If you had tailed the top 3 props last week</span>
        {' '}at ${betSize}/bet: estimated <span className="font-bold text-emerald-300">+${projProfit}</span> profit.
        {' '}Delta surfaces these before the line adjusts.
      </InfoCallout>
    </div>
  )
}

// ─── Screen: Whale Feed ───────────────────────────────────────────────────────

const INITIAL_WHALE_ROWS = [
  { amount: '$74,000', game: 'Lakers vs Nuggets · Total', line: 'OVER 226.5', time: '3m',
    moved: 'Line moved from 224 to 226.5 within 18 min of this ticket.' },
  { amount: '$58,000', game: 'Rangers vs Bruins · Puck Line', line: 'NYR -1.5', time: '11m', moved: null },
  { amount: '$91,000', game: 'Knicks vs Bucks · ML', line: 'NYK +140', time: '33m', moved: null },
]
const ARRIVING_ROW = { amount: '$63,500', game: 'Warriors vs Thunder · Spread', line: 'GSW +4.5', time: 'just now', moved: null }

function ScreenWhale({ draft, rm }: { draft: TrialOnboardingDraft; rm: boolean }) {
  const [rows, setRows] = useState(INITIAL_WHALE_ROWS)
  const [newRow, setNewRow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setNewRow(true)
      setRows((prev) => [ARRIVING_ROW, ...prev])
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  const primaryGoal = draft.goals[0]
  const whaleContext: Record<string, string> = {
    'beat-the-book': 'Whale money often precedes line corrections. Catch it here first.',
    'find-sharp-lines': 'This is your signal. When a $50K+ ticket hits, the line moves within minutes.',
    'track-whale-activity': 'This is your #1 tool — large-ticket alerts live as they happen.',
    'validate-picks': 'Cross-check whale direction against your picks for confirmation.',
  }
  const contextLine = primaryGoal ? whaleContext[primaryGoal] : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Pill>Step 6 of 10</Pill>
          <Waves className="h-4 w-4 text-emerald-300" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Whale Feed</h2>
        <p className="mt-1.5 text-sm text-white/50">
          {contextLine ?? '$50K+ tickets live as they hit. You see the move before the line adjusts.'}
        </p>
      </div>

      <MockupShell badge="LIVE"  liveDot>
        <div className="space-y-2">
          <AnimatePresence>
            {rows.map((row, i) => (
              <motion.div
                key={row.amount + row.time}
                initial={rm ? {} : { opacity: 0, y: i === 0 && newRow ? -10 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-xl border border-white/7 bg-black/20 px-3 py-2.5"
                style={{ borderLeft: '2px solid rgba(52,211,153,0.22)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-emerald-300">{row.amount}</div>
                    <div className="mt-0.5 truncate text-xs text-white/50">{row.game}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200">{row.line}</span>
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/28">{row.time} ago</div>
                  </div>
                </div>
                {row.moved && (
                  <div className="mt-1.5 text-[10px] text-amber-300/70">↑ {row.moved}</div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </MockupShell>

      <InfoCallout>
        Delta compares the whale ticket timing against exchange and sportsbook pricing — so you can distinguish real steam from noise.
      </InfoCallout>
    </div>
  )
}

// ─── Screen: Research Mode ────────────────────────────────────────────────────

const BEFORE_BARS = [
  { label: 'Closing line value', value: '+1.1%', pct: 14, warn: false },
  { label: 'Market movement accuracy', value: '54%', pct: 54, warn: true },
  { label: 'Sharp-aligned bets', value: '41%', pct: 41, warn: true },
  { label: 'Win rate on sharp picks', value: '48%', pct: 48, warn: true },
]
const AFTER_BARS = [
  { label: 'Closing line value', value: '+4.3%', pct: 57, warn: false },
  { label: 'Market movement accuracy', value: '71%', pct: 71, warn: false },
  { label: 'Sharp-aligned bets', value: '68%', pct: 68, warn: false },
  { label: 'Win rate on sharp picks', value: '57%', pct: 57, warn: true },
]

const EXP_PROJECTIONS: Record<TrialExperience, string> = {
  'casual-fan': 'Members at your level average +1.8% CLV improvement in their first 30 days.',
  'recreational': 'Members at your level average +2.3% CLV improvement in their first 30 days.',
  'serious-bettor': 'Members at your level average +3.1% CLV improvement in their first 30 days.',
  'sharp-pro': 'At your level, CLV improvement is more incremental — members average +1.4%, but signal quality compounds over 90+ days.',
}

function ScreenResearch({ draft, rm }: { draft: TrialOnboardingDraft; rm: boolean }) {
  const [showAfter, setShowAfter] = useState(false)
  const bars = showAfter ? AFTER_BARS : BEFORE_BARS
  const expProj = draft.experienceLevel ? EXP_PROJECTIONS[draft.experienceLevel] : EXP_PROJECTIONS['recreational']

  const primaryGoal = draft.goals[0]
  const researchContext: Record<string, string> = {
    'beat-the-book': 'Backtest which edges have held over time. Confirms your process before you size up.',
    'find-sharp-lines': 'Historical CLV tracking shows which line types move most consistently.',
    'track-whale-activity': 'Research Mode validates: do whale bets actually beat closing line?',
    'validate-picks': 'This is your #1 tool — CLV history and backtesting built for your workflow.',
  }
  const contextLine = primaryGoal ? researchContext[primaryGoal] : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Pill>Step 7 of 10</Pill>
          <FlaskConical className="h-4 w-4 text-emerald-400/60" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Research Mode</h2>
        <p className="mt-1.5 text-sm text-white/50">
          {contextLine ?? 'Track CLV, backtest your process, and see what a disciplined system looks like.'}
        </p>
      </div>

      <MockupShell badge="SYNDICATE">
        {/* Before / After toggle */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/28">Your last 30 days</span>
          <div className="flex rounded-full border border-white/10 bg-black/30 p-0.5">
            {['Before', 'After'].map((label) => {
              const active = label === 'After' ? showAfter : !showAfter
              return (
                <button
                  key={label}
                  onClick={() => setShowAfter(label === 'After')}
                  className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-semibold transition-all',
                    active ? 'bg-emerald-400/20 text-emerald-300' : 'text-white/35'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          {bars.map((bar, i) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{bar.label}</span>
                <span className={cn('font-bold', bar.warn ? 'text-amber-300' : 'text-emerald-300')}>
                  {bar.value}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/7">
                <motion.div
                  key={`${showAfter}-${bar.label}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${bar.pct}%` }}
                  transition={rm ? {} : { duration: 0.85, ease: 'easeOut', delay: i * 0.1 }}
                  className={cn('h-full rounded-full', bar.warn ? 'bg-amber-400' : 'bg-emerald-400')}
                  style={{ boxShadow: bar.warn ? '0 0 4px rgba(251,191,36,0.35)' : '0 0 4px rgba(52,211,153,0.3)' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
          <Lock className="mb-0.5 mr-1.5 inline h-3 w-3" />
          Full history unlocks with <span className="font-semibold text-emerald-300">Syndicate</span>
        </div>
      </MockupShell>

      <InfoCallout>
        <span className="font-semibold text-emerald-200">{draft.name ? draft.name.split(' ')[0] + ': ' : ''}</span>
        {expProj}
      </InfoCallout>
    </div>
  )
}

// ─── Screen: ROI ──────────────────────────────────────────────────────────────

function calcWinsNeeded(betSize: number, planCost = ROI_PLAN_COST): number {
  const profitPerWin = betSize * (100 / 110)
  return Math.ceil(planCost / profitPerWin)
}

function ScreenRoi({
  draft,
  onBetSize,
  onBetsPerDay,
  rm,
}: {
  draft: TrialOnboardingDraft
  onBetSize: (v: number) => void
  onBetsPerDay: (v: number) => void
  rm: boolean
}) {
  const betSize = draft.betSize
  const betsPerDay = draft.betsPerDay
  const betsPerMonth = betsPerDay * 30
  const winsNeeded = calcWinsNeeded(betSize)
  const profitPerWin = (betSize * (100 / 110)).toFixed(0)
  const isOne = winsNeeded === 1

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5">
          <Pill>Step 8 of 10</Pill>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          {draft.name ? `${draft.name.split(' ')[0]}, how much do you bet?` : 'How much do you bet?'}
        </h2>
        <p className="mt-1.5 text-sm text-white/50">
          We'll show you exactly what Delta needs to pay for itself.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {/* Bet size slider */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">Avg bet size</span>
            <span className="text-base font-black text-white">${betSize}</span>
          </div>
          <Slider
            min={25} max={500} step={25}
            value={[betSize]}
            onValueChange={([v]) => onBetSize(v!)}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/28">
            <span>$25</span><span>$500</span>
          </div>
        </div>

        {/* Bets per day slider */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">Bets per day</span>
            <span className="text-base font-black text-white">{betsPerDay}</span>
          </div>
          <Slider
            min={1} max={10} step={1}
            value={[betsPerDay]}
            onValueChange={([v]) => onBetsPerDay(v!)}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/28">
            <span>1/day</span><span>10/day</span>
          </div>
        </div>
      </div>

      {/* The payoff answer */}
      <motion.div
        key={winsNeeded}
        initial={rm ? {} : { scale: 0.97, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-black p-6 text-center"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(52,211,153,0.14),transparent_70%)]" />
        <div className="relative">
          <div className="text-6xl font-black text-emerald-300" style={{ textShadow: '0 0 40px rgba(52,211,153,0.5)' }}>
            {winsNeeded}
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            extra {isOne ? 'win' : 'wins'} per month
          </div>
          <div className="mt-2 text-sm text-white/45">
            That's all Delta needs to pay for itself.
          </div>
          <div className="mt-3 text-xs text-white/30">
            At ${betSize}/bet (−110 odds), {isOne ? '1 win' : `${winsNeeded} wins`} = ${isOne ? profitPerWin : (Number(profitPerWin) * winsNeeded).toFixed(0)} profit · Delta costs $79/mo
          </div>
        </div>
      </motion.div>

      <p className="text-center text-xs text-white/35">
        You're placing ~{betsPerMonth} bets/month.{' '}
        <span className="text-white/55">Delta only needs {winsNeeded} of them.</span>
      </p>
    </div>
  )
}

// ─── Screen: Final ────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: 'Marcus K.',
    plan: 'Syndicate · 4 months',
    color: 'emerald',
    quote: 'Saw an $82K whale alert on the Lakers over. Line moved 2.5 points within 20 minutes. I was already in.',
  },
  {
    name: 'Ryan T.',
    plan: 'Syndicate · 6 months',
    color: 'emerald',
    quote: 'Research Mode took my CLV from +1.1% to +4.3% in 30 days. I finally have a process that works.',
  },
]

const TOOLS_LIST: Array<{ icon: ReactNode; title: string; desc: string }> = [
  { icon: <ChartNoAxesCombined className="h-4 w-4" />, title: 'Sharp Projections', desc: 'Edge-ranked spreads, totals, moneylines' },
  { icon: <Activity className="h-4 w-4" />,            title: 'Sharp Props',       desc: 'Orderbook pressure and lean scoring' },
  { icon: <Waves className="h-4 w-4" />,               title: 'Whale Feed',        desc: 'Large-ticket alerts, live' },
  { icon: <FlaskConical className="h-4 w-4" />,        title: 'Research Mode',     desc: 'CLV tracking and backtesting' },
]

function ScreenFinal({
  draft,
  isSubmitting,
  onSubmit,
  rm,
}: {
  draft: TrialOnboardingDraft
  isSubmitting: boolean
  onSubmit: () => void
  rm: boolean
}) {
  const firstName = draft.name ? draft.name.split(' ')[0] : null
  const topTool = draft.prioritizedTools[0] ? TOOL_DISPLAY_NAMES[draft.prioritizedTools[0]] : 'Sharp Projections'
  const winsNeeded = calcWinsNeeded(draft.betSize)

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={rm ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-black tracking-tight text-white">
          {firstName ? `You're almost in, ${firstName}.` : "You're almost in."}
        </h2>
        <p className="mt-1.5 text-sm text-white/50">
          Your setup is ready. Here's what you're getting access to.
        </p>
      </motion.div>

      {/* Personal summary */}
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <p className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-300/60">Your delta profile</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-white/45">Starting tool</span>
            <span className="font-semibold text-white">{topTool}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Bet size</span>
            <span className="font-semibold text-white">${draft.betSize}/bet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Wins to break even</span>
            <span className="font-semibold text-emerald-300">{winsNeeded}/month</span>
          </div>
        </div>
      </div>

      {/* 4 tools */}
      <div className="grid grid-cols-2 gap-2">
        {TOOLS_LIST.map((t, i) => (
          <motion.div
            key={t.title}
            initial={rm ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
          >
            <div className="mb-1.5 text-emerald-300">{t.icon}</div>
            <div className="text-xs font-bold text-white">{t.title}</div>
            <div className="mt-0.5 text-[10px] text-white/38">{t.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Testimonials */}
      <div className="space-y-2">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
            <div className="mb-2 flex items-center gap-2.5">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black',
                'bg-emerald-400'
              )}>
                {t.name[0]}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{t.name}</div>
                <div className="text-[10px] text-white/35">{t.plan}</div>
              </div>
              <span className="ml-auto text-[10px] text-amber-300">★★★★★</span>
            </div>
            <p className="text-xs leading-relaxed text-white/60">"{t.quote}"</p>
          </div>
        ))}
      </div>

      {/* Guarantee */}
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/6 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <div className="text-sm font-bold text-emerald-200">7-Day Free Trial Guarantee</div>
            <div className="mt-1 text-xs leading-relaxed text-white/55">
              Cancel before day 3 and you pay nothing — one click, no forms, no calls.
            </div>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">What happens next</p>
        <div className="relative space-y-3 pl-6">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-emerald-400/15" />
          {[
            'Secure checkout via Stripe',
            'Instant access — all 4 tools live',
            'Cancel anytime, one click',
          ].map((step, i) => (
            <div key={step} className="relative flex items-start gap-3">
              <div className="absolute -left-6 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-black text-[9px] font-bold text-emerald-300">
                {i + 1}
              </div>
              <span className="text-xs text-white/60">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA button (inline, since this screen manages its own submit) */}
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="ob-cta-shimmer w-full rounded-full bg-[linear-gradient(90deg,#3CCB97,#22d3ee,#3CCB97)] py-4 text-sm font-bold text-black transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Setting up your account…
          </span>
        ) : (
          firstName ? `Start ${firstName}'s free trial →` : 'Start my free trial →'
        )}
      </button>

      <p className="text-center text-[11px] text-white/28">
        <Shield className="mr-1 inline h-3 w-3" />
        Stripe secure · Cancel anytime · Instant access
      </p>
    </div>
  )
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export default function TrialOnboardingFlow() {
  const rm = useReducedMotion() ?? false
  const [screenIndex, setScreenIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [draft, setDraft] = useState<TrialOnboardingDraft>(createDefaultTrialOnboardingDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const screen = SCREENS[screenIndex]!

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TRIAL_ONBOARDING_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TrialOnboardingDraft>
        setDraft((prev) => ({ ...prev, ...parsed }))
      }
    } catch {}
    trackTrialFlowEvent('onboarding_started', { screen: 'welcome' })
  }, [])

  function updateDraft(patch: Partial<TrialOnboardingDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      syncDraft(next)
      return next
    })
  }

  function goNext() {
    if (screenIndex >= SCREENS.length - 1) return
    trackTrialFlowEvent('onboarding_step_completed', {
      step: screen.id,
      step_index: screenIndex,
    })
    setDirection(1)
    setScreenIndex((i) => i + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    if (screenIndex === 0) return
    setDirection(-1)
    setScreenIndex((i) => i - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleName(v: string) {
    updateDraft({ name: v })
  }

  function handleExperience(v: TrialExperience) {
    const tools = prioritizeTools(draft.goals, v)
    updateDraft({ experienceLevel: v, prioritizedTools: tools })
  }

  function handleGoalToggle(key: TrialGoalKey) {
    const next = draft.goals.includes(key)
      ? draft.goals.filter((g) => g !== key)
      : [...draft.goals, key]
    const tools = prioritizeTools(next, draft.experienceLevel)
    updateDraft({ goals: next, prioritizedTools: tools })
  }

  function handleBetSize(v: number) {
    const roi = calculateRoiSnapshot(v, draft.betsPerDay)
    updateDraft({ betSize: v, monthlyEv: roi.monthly_ev, yearlyEv: roi.yearly_ev, roiVsPlanCost: roi.roi_vs_plan_cost })
  }

  function handleBetsPerDay(v: number) {
    const roi = calculateRoiSnapshot(draft.betSize, v)
    updateDraft({ betsPerDay: v, monthlyEv: roi.monthly_ev, yearlyEv: roi.yearly_ev, roiVsPlanCost: roi.roi_vs_plan_cost })
  }

  async function handleSubmit() {
    if (isSubmitting) return
    setIsSubmitting(true)
    trackTrialFlowEvent('onboarding_completed', {
      experience_level: draft.experienceLevel ?? '',
      primary_goal: draft.goals[0] ?? '',
      bet_size: draft.betSize,
      bets_per_day: draft.betsPerDay,
    })
    try {
      await fetch('/api/trial-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          experienceLevel: draft.experienceLevel,
          goals: draft.goals,
          betSize: draft.betSize,
          betsPerDay: draft.betsPerDay,
        }),
      })
      trackTrialFlowEvent('checkout_started_from_onboarding', { source: 'final_screen' })
      window.location.href = '/checkout?source=trial-onboarding-v2'
    } catch {
      setIsSubmitting(false)
    }
  }

  // CTA disabled logic
  const ctaDisabled = (() => {
    if (screen.id === 'name') return draft.name.trim().length === 0
    if (screen.id === 'experience') return !draft.experienceLevel
    if (screen.id === 'goals') return draft.goals.length === 0
    return false
  })()

  const showProgress = screen.id !== 'welcome'
  const showBack = screenIndex > 0
  const isFinal = screen.id === 'final'

  const variants = {
    enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* ── Top bar ── */}
      <div className="fixed left-0 right-0 top-0 z-30 bg-black/95 backdrop-blur">
        {/* Progress bar */}
        {showProgress && (
          <div className="h-0.5 bg-white/8">
            <motion.div
              className="h-full bg-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${screen.progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
          {showBack ? (
            <button
              onClick={goBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-8 w-8 shrink-0" />
          )}
          <div className="flex-1 text-center text-xs font-medium text-white/40">
            {screen.label}
          </div>
          <div className="h-8 w-8 shrink-0" />
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-20">
        <div className="mx-auto w-full max-w-lg">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={screen.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {screen.id === 'welcome'     && <ScreenWelcome rm={rm} />}
              {screen.id === 'name'        && <ScreenName draft={draft} onName={handleName} rm={rm} />}
              {screen.id === 'experience'  && <ScreenExperience draft={draft} onSelect={handleExperience} rm={rm} />}
              {screen.id === 'goals'       && <ScreenGoals draft={draft} onToggle={handleGoalToggle} rm={rm} />}
              {screen.id === 'projections' && <ScreenProjections draft={draft} rm={rm} />}
              {screen.id === 'props'       && <ScreenProps draft={draft} rm={rm} />}
              {screen.id === 'whale'       && <ScreenWhale draft={draft} rm={rm} />}
              {screen.id === 'research'    && <ScreenResearch draft={draft} rm={rm} />}
              {screen.id === 'roi'         && <ScreenRoi draft={draft} onBetSize={handleBetSize} onBetsPerDay={handleBetsPerDay} rm={rm} />}
              {screen.id === 'final'       && <ScreenFinal draft={draft} isSubmitting={isSubmitting} onSubmit={handleSubmit} rm={rm} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Fixed bottom CTA (hidden on final — it has its own inline button) ── */}
      {!isFinal && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/8 bg-black/95 px-5 py-4 backdrop-blur"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-lg">
            <button
              onClick={goNext}
              disabled={ctaDisabled}
              className={cn(
                'w-full rounded-full py-3.5 text-sm font-bold transition-all',
                ctaDisabled
                  ? 'bg-white/8 text-white/25 cursor-not-allowed'
                  : 'ob-cta-shimmer bg-[linear-gradient(90deg,#3CCB97,#22d3ee,#3CCB97)] text-black'
              )}
            >
              {screen.cta}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
