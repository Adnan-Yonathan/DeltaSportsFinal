'use client'

type SignalType = 'whale' | 'edge' | 'prop'

const SIGNALS: Array<{ type: SignalType; value: string; detail: string; time: string }> = [
  { type: 'whale', value: '$74,000',  detail: 'Lakers vs Nuggets · Total OVER 226.5', time: '3m' },
  { type: 'edge',  value: 'Edge +4.8', detail: 'Celtics vs 76ers · BOS -5.5',          time: '9m' },
  { type: 'prop',  value: '81% lean', detail: 'N. Jokić O26.5 pts · Over',             time: '14m' },
  { type: 'whale', value: '$58,000',  detail: 'Rangers vs Bruins · Puck Line -1.5',    time: '18m' },
  { type: 'edge',  value: 'Edge +3.2', detail: 'Duke vs UNC · Total UNDER 149.5',      time: '26m' },
  { type: 'whale', value: '$91,000',  detail: 'Knicks vs Bucks · NYK ML',              time: '33m' },
  { type: 'prop',  value: '74% lean', detail: 'L. James O22.5 pts · Over',             time: '41m' },
  { type: 'edge',  value: 'Edge +2.7', detail: 'Avalanche vs Panthers · Total Over 6', time: '48m' },
  { type: 'whale', value: '$63,500',  detail: 'Warriors vs Thunder · GSW +4.5',        time: '1h' },
  { type: 'prop',  value: '69% lean', detail: 'T. Purdue O18.5 pts · Over',            time: '1h' },
  { type: 'edge',  value: 'Edge +5.1', detail: 'Kansas vs Houston · Spread KU -3',     time: '1h' },
  { type: 'whale', value: '$112,000', detail: 'Lightning vs Maple Leafs · ML -130',    time: '2h' },
]

const TYPE_STYLES: Record<SignalType, { label: string; value: string; badge: string }> = {
  whale: {
    label: 'WHALE',
    value: 'text-emerald-300',
    badge: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300',
  },
  edge: {
    label: 'SHARP',
    value: 'text-cyan-300',
    badge: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-300',
  },
  prop: {
    label: 'PROP',
    value: 'text-violet-300',
    badge: 'border-violet-300/25 bg-violet-400/10 text-violet-300',
  },
}

function TickerItem({ signal }: { signal: (typeof SIGNALS)[number] }) {
  const styles = TYPE_STYLES[signal.type]
  return (
    <div className="inline-flex shrink-0 items-center gap-3 px-5">
      <span
        className={`rounded-full border px-2 py-0.5 font-hero text-[9px] font-bold uppercase tracking-[0.2em] ${styles.badge}`}
      >
        {styles.label}
      </span>
      <span className={`text-sm font-bold ${styles.value}`}>{signal.value}</span>
      <span className="text-sm text-white/55">{signal.detail}</span>
      <span className="font-hero text-[10px] uppercase tracking-[0.18em] text-white/28">{signal.time} ago</span>
      <span className="text-white/15">·</span>
    </div>
  )
}

export function LiveTicker() {
  // Duplicate items for seamless loop
  const items = [...SIGNALS, ...SIGNALS]

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/60 py-5 backdrop-blur">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="ob-live-dot" />
          <span className="font-hero text-[10px] uppercase tracking-[0.34em] text-white/55">
            Live signals
          </span>
        </div>
        <span className="font-hero text-[10px] uppercase tracking-[0.28em] text-white/28">
          Updated in real time
        </span>
      </div>

      {/* Ticker track */}
      <div className="relative">
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black to-transparent" />

        <div className="flex overflow-hidden">
          <div className="animate-slide-track flex whitespace-nowrap">
            {items.map((signal, i) => (
              <TickerItem key={`${signal.value}-${i}`} signal={signal} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer callout */}
      <div className="mt-4 border-t border-white/8 px-5 pt-4 text-center">
        <p className="text-xs text-white/38">
          Delta members receive these signals before the market adjusts.{' '}
          <a href="/auth/signup" className="text-emerald-300/80 underline underline-offset-2 hover:text-emerald-300">
            Start free →
          </a>
        </p>
      </div>
    </section>
  )
}
