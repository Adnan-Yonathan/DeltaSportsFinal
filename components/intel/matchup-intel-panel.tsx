"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { AlertTriangle } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export type MatchupPanelContext = {
  id: string
  source: "sharp-projections" | "research-mode"
  sportKey: string
  awayTeam: string
  homeTeam: string
  commenceTime?: string | null
  summary: {
    edgePercent?: number | null
    betLabel?: string | null
    market?: string | null
    line?: string | null
    hitRate?: string | null
    lineMovement?: string | null
    sharpLine?: string | null
    narrative?: string | null
    sharpSignals?: string[]
  }
}

type TeamMetric = {
  label: string
  value: string
}

type TeamTrend = {
  spreadRecord: string | null
  spreadRoi: string | null
  totalsRecord: string | null
  totalsRoi: string | null
  moneylineRecord: string | null
  moneylineRoi: string | null
}

type TeamProfile = {
  name: string
  abbr: string | null
  logoUrl: string | null
  record: string | null
  metrics: TeamMetric[]
  trend: TeamTrend | null
}

export type MatchupIntelResponse = {
  updatedAt: string
  matchup: {
    sportKey: string
    commenceTime: string | null
    awayTeam: TeamProfile
    homeTeam: TeamProfile
  }
  sbd: {
    league: string | null
    matched: boolean
    gameId: string | null
    status: string | null
    splits: {
      updatedAt: string | null
      moneyline: {
        homeBetsPct: number | null
        homeMoneyPct: number | null
        awayBetsPct: number | null
        awayMoneyPct: number | null
      } | null
      spread: {
        homeBetsPct: number | null
        homeMoneyPct: number | null
        awayBetsPct: number | null
        awayMoneyPct: number | null
      } | null
      total: {
        overBetsPct: number | null
        overMoneyPct: number | null
        underBetsPct: number | null
        underMoneyPct: number | null
      } | null
    } | null
  }
  insights: string[]
}

export type MatchupIntelPanelStatus = "loading" | "ready" | "error"

const normalizeKey = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

export const buildMatchupIntelKey = (params: {
  sportKey: string
  awayTeam: string
  homeTeam: string
  commenceTime?: string | null
}) =>
  `${params.sportKey}:${normalizeKey(params.awayTeam)}:${normalizeKey(params.homeTeam)}:${String(
    params.commenceTime || ""
  ).slice(0, 16)}`

const sourceLabelMap: Record<MatchupPanelContext["source"], string> = {
  "sharp-projections": "Sharp Movement",
  "research-mode": "Research Mode",
}

const toDateTimeLabel = (value?: string | null) => {
  if (!value) return "TBD"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const toPercent = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return `${value.toFixed(1)}%`
}

const toDelta = (a?: number | null, b?: number | null) => {
  if (a == null || b == null) return "--"
  const delta = a - b
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`
}

const toMetricNumber = (value: string | null | undefined) => {
  if (!value) return null
  const cleaned = value.replace(/[^\d.-]/g, "")
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function TeamBadge({ team }: { team: TeamProfile }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {team.logoUrl ? (
            <Image src={team.logoUrl} alt={team.name} fill sizes="40px" className="object-contain p-1.5" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
              {team.abbr || team.name.slice(0, 3).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{team.name}</div>
          <div className="truncate text-xs text-white/55">
            {team.abbr ? `${team.abbr} | ` : ""}
            {team.record || "Record n/a"}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComparisonTable({ awayTeam, homeTeam }: { awayTeam: TeamProfile; homeTeam: TeamProfile }) {
  const rows = useMemo(() => {
    const awayMap = new Map(awayTeam.metrics.map((metric) => [metric.label, metric.value]))
    const homeMap = new Map(homeTeam.metrics.map((metric) => [metric.label, metric.value]))
    const labels = Array.from(new Set([...awayMap.keys(), ...homeMap.keys()]))

    return labels.map((label) => {
      const awayValue = awayMap.get(label) || "--"
      const homeValue = homeMap.get(label) || "--"
      const awayNum = toMetricNumber(awayValue)
      const homeNum = toMetricNumber(homeValue)
      const lean =
        awayNum != null && homeNum != null
          ? awayNum > homeNum
            ? "away"
            : homeNum > awayNum
              ? "home"
              : "even"
          : "none"

      return { label, awayValue, homeValue, lean }
    })
  }, [awayTeam.metrics, homeTeam.metrics])

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white/55">
        Team metric comparison unavailable.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/35">
      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/45">
        <div className="text-left">{awayTeam.abbr || "Away"}</div>
        <div className="text-center">Metric</div>
        <div className="text-right">{homeTeam.abbr || "Home"}</div>
      </div>
      <div className="divide-y divide-white/10">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-2 text-sm">
            <div className={row.lean === "away" ? "font-semibold text-emerald-300" : "text-white/80"}>
              {row.awayValue}
            </div>
            <div className="px-2 text-center text-xs text-white/55">{row.label}</div>
            <div className={row.lean === "home" ? "text-right font-semibold text-emerald-300" : "text-right text-white/80"}>
              {row.homeValue}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamTrendBlock({ team }: { team: TeamProfile }) {
  const trend = team.trend
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-xs text-white/75">
      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
        {team.abbr || team.name}
      </div>
      <div>Spread: {trend?.spreadRecord || "--"} {trend?.spreadRoi ? `(${trend.spreadRoi})` : ""}</div>
      <div>Total: {trend?.totalsRecord || "--"} {trend?.totalsRoi ? `(${trend.totalsRoi})` : ""}</div>
      <div>Moneyline: {trend?.moneylineRecord || "--"} {trend?.moneylineRoi ? `(${trend.moneylineRoi})` : ""}</div>
    </div>
  )
}

function SplitBar({
  label,
  homeBets,
  homeMoney,
  awayBets,
  awayMoney,
}: {
  label: string
  homeBets?: number | null
  homeMoney?: number | null
  awayBets?: number | null
  awayMoney?: number | null
}) {
  if (homeBets == null && homeMoney == null && awayBets == null && awayMoney == null) return null
  const awayWidth = awayMoney != null ? `${Math.max(0, Math.min(100, awayMoney))}%` : "0%"
  const homeWidth = homeMoney != null ? `${Math.max(0, Math.min(100, homeMoney))}%` : "0%"

  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-cyan-300/70" style={{ width: awayWidth }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-white/70">
        <span>Away Bets {toPercent(awayBets)} | Money {toPercent(awayMoney)}</span>
        <span>Delta {toDelta(awayMoney, awayBets)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-emerald-300/70" style={{ width: homeWidth }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-white/70">
        <span>Home Bets {toPercent(homeBets)} | Money {toPercent(homeMoney)}</span>
        <span>Delta {toDelta(homeMoney, homeBets)}</span>
      </div>
    </div>
  )
}

function LoadingSection({ title }: { title: string }) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">{title}</h3>
      <div className="mt-2 space-y-2">
        <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
        <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
      </div>
    </section>
  )
}

function SnapshotChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className="mt-0.5 text-sm text-white/85">{value}</div>
    </div>
  )
}

export default function MatchupIntelPanel({
  open,
  onOpenChange,
  context,
  intel,
  status,
  errorMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: MatchupPanelContext | null
  intel: MatchupIntelResponse | null
  status: MatchupIntelPanelStatus
  errorMessage?: string | null
}) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const query = window.matchMedia("(min-width: 1024px)")
    const handleChange = () => setIsDesktop(query.matches)
    handleChange()
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  const sourceLabel = context ? sourceLabelMap[context.source] : ""
  const matchupLabel = context ? `${context.awayTeam} vs ${context.homeTeam}` : ""
  const headerTime = intel?.matchup.commenceTime ?? context?.commenceTime
  const awayTeam = intel?.matchup.awayTeam
  const homeTeam = intel?.matchup.homeTeam
  const splits = intel?.sbd.splits
  const snapshotItems = useMemo(() => {
    if (!context) return []
    return [
      {
        label: "Edge",
        value:
          context.summary.edgePercent != null && Number.isFinite(context.summary.edgePercent)
            ? `+${context.summary.edgePercent.toFixed(1)}%`
            : null,
      },
      { label: "Bet", value: context.summary.betLabel ?? null },
      { label: "Market", value: context.summary.market ?? null },
      { label: "Line", value: context.summary.line ?? null },
      { label: "% To Hit", value: context.summary.hitRate ?? null },
      { label: "Sharp Line", value: context.summary.sharpLine ?? null },
    ] as Array<{ label: string; value: string | null }>
  }, [context])

  const showLoadingState = status === "loading" && !intel
  const showErrorState = status === "error" && !intel

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "center" : "bottom"}
        className={
          isDesktop
            ? "!max-h-[90vh] w-[min(95vw,1240px)] overflow-hidden border border-white/10 bg-[#04070d] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
            : "!h-[92vh] w-full overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#04070d] p-0 text-white"
        }
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/10 bg-black/40">
            <SheetTitle className="text-base text-white">{matchupLabel}</SheetTitle>
            <SheetDescription className="text-xs text-white/50">
              {sourceLabel} | {toDateTimeLabel(headerTime)}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
            <div className="space-y-3">
              {showLoadingState ? (
                <>
                  <LoadingSection title="Team Matchup" />
                  <LoadingSection title="Trends" />
                  <LoadingSection title="Insights" />
                </>
              ) : showErrorState ? (
                <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
                    <div className="text-sm text-red-100">
                      {errorMessage || "Failed to load matchup details."}
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Current Position</h3>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {snapshotItems.map((item) => (
                        <SnapshotChip key={item.label} label={item.label} value={item.value} />
                      ))}
                    </div>
                  </section>

                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Team Matchup</h3>
                    {awayTeam && homeTeam ? (
                      <div className="mt-2.5 space-y-2.5">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <TeamBadge team={awayTeam} />
                          <TeamBadge team={homeTeam} />
                        </div>
                        <ComparisonTable awayTeam={awayTeam} homeTeam={homeTeam} />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white/55">
                        Team matchup data unavailable.
                      </div>
                    )}
                  </section>

                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Trends</h3>
                    {awayTeam && homeTeam ? (
                      <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                        <TeamTrendBlock team={awayTeam} />
                        <TeamTrendBlock team={homeTeam} />
                      </div>
                    ) : null}
                    {splits ? (
                      <div className="mt-2.5 space-y-2">
                        <SplitBar
                          label="Moneyline Splits"
                          homeBets={splits.moneyline?.homeBetsPct}
                          homeMoney={splits.moneyline?.homeMoneyPct}
                          awayBets={splits.moneyline?.awayBetsPct}
                          awayMoney={splits.moneyline?.awayMoneyPct}
                        />
                        <SplitBar
                          label="Spread Splits"
                          homeBets={splits.spread?.homeBetsPct}
                          homeMoney={splits.spread?.homeMoneyPct}
                          awayBets={splits.spread?.awayBetsPct}
                          awayMoney={splits.spread?.awayMoneyPct}
                        />
                        <SplitBar
                          label="Totals Splits"
                          homeBets={splits.total?.underBetsPct}
                          homeMoney={splits.total?.underMoneyPct}
                          awayBets={splits.total?.overBetsPct}
                          awayMoney={splits.total?.overMoneyPct}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white/55">
                        Trends unavailable for this matchup.
                      </div>
                    )}
                  </section>

                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Insights</h3>
                    {intel?.insights?.length ? (
                      <div className="mt-2 space-y-2">
                        {intel.insights.map((insight, index) => (
                          <div
                            key={`${insight}-${index}`}
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/80"
                          >
                            {insight}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white/55">
                        No matchup insights available yet.
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
