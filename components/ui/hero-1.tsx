import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, RocketIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const ACCENT = '#3CCB97'

type HeroSectionProps = {
  className?: string
}

export function HeroSection({ className }: HeroSectionProps) {
  const reduceMotion = useReducedMotion()

  const fadeUp = {
    initial: reduceMotion ? undefined : { opacity: 0, y: 14 },
    animate: reduceMotion ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' as const },
  }

  return (
    <section
      className={cn(
        'relative isolate mx-auto w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-black',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(68%_88%_at_20%_0%,rgba(60,203,151,0.16),rgba(0,0,0,0.76)_52%,rgba(0,0,0,0.98)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[-30%] h-[60%] bg-black [clip-path:polygon(0_32%,100%_0,100%_100%,0_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-white/15 lg:block" />
      <div className="pointer-events-none absolute inset-y-0 right-8 hidden w-px bg-white/15 lg:block" />

      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, scale: 0.98, rotate: -17 }}
        animate={reduceMotion ? undefined : { opacity: 0.7, scale: 1, rotate: -17 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="pointer-events-none absolute -right-28 bottom-[-320px] w-[min(980px,96vw)] opacity-70 blur-[2px]"
      >
        <DashboardBackdrop />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center px-6 pb-56 pt-24 text-center sm:pt-28 lg:px-10 lg:pb-64">
        <motion.a
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
          href="#betproof-showcase"
          className="group inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs shadow"
          style={{
            borderColor: 'rgba(60,203,151,0.35)',
            backgroundColor: 'rgba(60,203,151,0.08)',
            color: ACCENT,
          }}
        >
          <RocketIcon className="size-3" />
          <span>trusted by 1000+ bettors</span>
          <span className="h-5 border-l" style={{ borderColor: 'rgba(60,203,151,0.35)' }} />
          <ArrowRightIcon className="size-3 duration-150 ease-out group-hover:translate-x-1" />
        </motion.a>

        <motion.h1
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.12 }}
          className={cn(
            'mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl',
            '[text-shadow:0_0_50px_rgba(60,203,151,0.28)]'
          )}
          style={{ color: '#ffffff' }}
        >
          Turn Data Into Profit
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="mt-6 max-w-2xl text-balance text-base tracking-wide sm:text-lg md:text-xl"
          style={{ color: '#ffffff' }}
        >
          Track sharp bettors in real time, and turn insights into long term winning.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.28 }}
          className="mt-8 flex items-center justify-center"
        >
          <Button
            asChild
            size="lg"
            className="rounded-full px-7 text-black"
            style={{ backgroundColor: ACCENT }}
          >
            <a href="/auth/signup">
              Try 7 days free
              <ArrowRightIcon className="ml-2 size-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

function DashboardBackdrop() {
  const rows = [
    { odds: '-300', amount: '$1.5K', width: '95%' },
    { odds: '-488', amount: '$3.4K', width: '100%' },
    { odds: '-525', amount: '$1.7K', width: '51%' },
    { odds: '-178', amount: '$410', width: '13%' },
    { odds: '-186', amount: '$340', width: '10%' },
    { odds: '-194', amount: '$181', width: '6%' },
    { odds: '+1150', amount: '$160', width: '5%', muted: true },
    { odds: '-213', amount: '$64', width: '3%' },
  ]

  return (
    <div className="rounded-[28px] border border-slate-700/55 bg-[#020913] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">NBA | Kalshi</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight text-white">NYK @ LAL</div>
      <div className="mt-3 flex items-center gap-4">
        <div className="text-6xl font-bold" style={{ color: ACCENT }}>$3.4K</div>
        <div className="text-xl text-slate-300">Whale Volume</div>
      </div>

      <div className="mt-7 rounded-2xl border border-slate-800 bg-[#030c19] p-4">
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: ACCENT }}>The Play</div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="https://cdn.nba.com/headshots/nba/latest/260x190/1629011.png"
              alt="Mitchell Robinson"
              className="size-11 rounded-full object-cover object-top"
            />
            <div>
              <div className="text-xl font-semibold text-white">Mitchell Robinson Over 10 points</div>
              <div className="text-sm text-slate-400">Best available market price</div>
            </div>
          </div>
          <div className="rounded-xl px-4 py-2 text-2xl font-bold text-black" style={{ backgroundColor: ACCENT }}>+488</div>
        </div>
      </div>

      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-slate-400">Whale Bets</div>
      <div className="mt-2 space-y-3">
        {rows.map((row) => (
          <div key={`${row.odds}-${row.amount}`} className="grid grid-cols-[78px_minmax(0,1fr)_78px] items-center gap-3">
            <div
              className={cn('text-3xl font-semibold', row.muted && 'text-slate-400')}
              style={row.muted ? undefined : { color: ACCENT }}
            >
              {row.odds}
            </div>
            <div className="h-8 rounded-full border border-slate-800 bg-[#01060d] p-[1px]">
              <div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r',
                  row.muted ? 'from-slate-700 to-slate-500' : 'from-[#2a9e75] to-[#3CCB97]'
                )}
                style={{ width: row.width }}
              />
            </div>
            <div className="text-right text-2xl text-slate-300">{row.amount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
