"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { AlertTriangle } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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

const splitDivergence = (betsPct?: number | null, moneyPct?: number | null) => {
  if (betsPct == null || moneyPct == null) return "--"
  const diff = moneyPct - betsPct
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}`
}

const sourceLabelMap: Record<MatchupPanelContext["source"], string> = {
  "sharp-projections": "Sharp Projections",
  "research-mode": "Research Mode",
}

function TeamCard({ team }: { team: TeamProfile }) {
  return (
    <div className="animate-in fade-in-0 zoom-in-95 duration-300 rounded-2xl border border-white/10 bg-black/35 p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {team.logoUrl ? (
            <Image src={team.logoUrl} alt={team.name} fill sizes="40px" className="object-contain p-1.5" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/40">
              {team.abbr || "TEAM"}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{team.name}</div>
          <div className="text-xs text-white/50">
            {team.abbr ? `${team.abbr} | ` : ""}
            {team.record || "Record n/a"}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {team.metrics.length > 0 ? (
          team.metrics.map((metric) => (
            <div key={`${team.name}-${metric.label}`} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{metric.label}</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{metric.value}</div>
            </div>
          ))
        ) : (
          <div className="col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/50">
            Team metrics unavailable.
          </div>
        )}
      </div>
      {team.trend && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Recent Team Trend</div>
          <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-white/70">
            <div>
              Spread: {team.trend.spreadRecord || "--"} {team.trend.spreadRoi ? `(${team.trend.spreadRoi})` : ""}
            </div>
            <div>
              Total: {team.trend.totalsRecord || "--"} {team.trend.totalsRoi ? `(${team.trend.totalsRoi})` : ""}
            </div>
            <div>
              Moneyline: {team.trend.moneylineRecord || "--"}{" "}
              {team.trend.moneylineRoi ? `(${team.trend.moneylineRoi})` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SnapshotRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className="mt-1 text-sm text-white/85">{value}</div>
    </div>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</h3>
      <div className="mt-2 space-y-2">
        <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
        <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
      </div>
    </section>
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

  const snapshotRows = useMemo(() => {
    if (!context) return []
    return [
      { label: "Edge", value: context.summary.edgePercent != null ? `+${context.summary.edgePercent.toFixed(1)}%` : null },
      { label: "Bet", value: context.summary.betLabel },
      { label: "Market", value: context.summary.market },
      { label: "Line", value: context.summary.line },
      { label: "% To Hit", value: context.summary.hitRate },
      { label: "Line Movement", value: context.summary.lineMovement },
      { label: "Sharp Line", value: context.summary.sharpLine },
      { label: "Narrative", value: context.summary.narrative },
    ]
  }, [context])

  const sharpSignals = context?.summary.sharpSignals ?? []
  const splits = intel?.sbd.splits

  const showLoadingState = status === "loading" && !intel
  const showErrorState = status === "error" && !intel

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "center" : "bottom"}
        className={
          isDesktop
            ? "max-h-[90vh] w-[min(95vw,1240px)] border border-white/10 bg-[#04070d] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
            : "h-[92vh] w-full rounded-t-3xl border-t border-white/10 bg-[#04070d] p-0 text-white"
        }
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-2">
                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-black/30">
                  {awayTeam?.logoUrl ? (
                    <Image src={awayTeam.logoUrl} alt={awayTeam.name} fill sizes="36px" className="object-contain p-1" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                      {awayTeam?.abbr || context?.awayTeam.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-black/30">
                  {homeTeam?.logoUrl ? (
                    <Image src={homeTeam.logoUrl} alt={homeTeam.name} fill sizes="36px" className="object-contain p-1" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                      {homeTeam?.abbr || context?.homeTeam.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <SheetTitle className="text-base text-white">{matchupLabel}</SheetTitle>
                <SheetDescription className="text-xs text-white/50">
                  {sourceLabel} | {toDateTimeLabel(headerTime)}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
            <div className="space-y-3">
              <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Current Snapshot</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {snapshotRows.map((row) => (
                    <SnapshotRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </div>
                {sharpSignals.length > 0 && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Sharp Signals</div>
                    <div className="mt-1 space-y-1 text-xs text-white/75">
                      {sharpSignals.slice(0, 4).map((signal, index) => (
                        <div key={`${signal}-${index}`}>{signal}</div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {showLoadingState ? (
                <>
                  <LoadingBlock label="Team Matchup" />
                  <LoadingBlock label="Betting Splits" />
                  <LoadingBlock label="Insights" />
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
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Team Matchup</h3>
                    {awayTeam && homeTeam ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <TeamCard team={awayTeam} />
                        <TeamCard team={homeTeam} />
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/55">
                        Matchup detail data not available yet.
                      </div>
                    )}
                  </section>

                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Betting Splits</h3>
                    {!splits ? (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/55">
                        No split snapshot found for this matchup.
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs text-white/50">
                          Updated {toDateTimeLabel(splits.updatedAt)} {intel?.sbd.status ? `| ${intel.sbd.status}` : ""}
                        </div>

                        {splits.moneyline && (
                          <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Moneyline</div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-white/75">
                              <div>Home Bets: {toPercent(splits.moneyline.homeBetsPct)}</div>
                              <div>Home Money: {toPercent(splits.moneyline.homeMoneyPct)}</div>
                              <div>Divergence: {splitDivergence(splits.moneyline.homeBetsPct, splits.moneyline.homeMoneyPct)}</div>
                            </div>
                          </div>
                        )}

                        {splits.spread && (
                          <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Spread</div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-white/75">
                              <div>Home Bets: {toPercent(splits.spread.homeBetsPct)}</div>
                              <div>Home Money: {toPercent(splits.spread.homeMoneyPct)}</div>
                              <div>Divergence: {splitDivergence(splits.spread.homeBetsPct, splits.spread.homeMoneyPct)}</div>
                            </div>
                          </div>
                        )}

                        {splits.total && (
                          <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Total</div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-white/75">
                              <div>Over Bets: {toPercent(splits.total.overBetsPct)}</div>
                              <div>Over Money: {toPercent(splits.total.overMoneyPct)}</div>
                              <div>Divergence: {splitDivergence(splits.total.overBetsPct, splits.total.overMoneyPct)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45">Insights</h3>
                    {intel?.insights?.length ? (
                      <div className="mt-2 space-y-2">
                        {intel.insights.map((insight, index) => (
                          <div key={`${insight}-${index}`} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white/80">
                            {insight}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/55">
                        No insights available yet.
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
