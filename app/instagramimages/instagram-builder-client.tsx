'use client'

import { useReducer, useRef, useEffect, useState, useCallback } from 'react'
import { ShareCaptureRoot } from '@/components/share/ShareCardFrame'
import InstagramFrame from '@/components/instagram/shared/InstagramFrame'

import TemplatePicker, { type TemplateType } from '@/components/instagram/shared/TemplatePicker'
import ExportBar from '@/components/instagram/shared/ExportBar'
import BackgroundLayer, { type BackgroundSettings } from '@/components/instagram/shared/BackgroundLayer'
import BackgroundEditor from '@/components/instagram/editors/BackgroundEditor'

import SharpPropsCard, { type SharpPropData } from '@/components/instagram/templates/PlayerPropCard'
import TeamInsiderCard, { type TeamInsiderData } from '@/components/instagram/templates/TeamInsiderCard'
import SeriesCover, { type SeriesCoverData } from '@/components/instagram/templates/SeriesCover'
import RankingsAuthority, { type RankingsData } from '@/components/instagram/templates/RankingsAuthority'
import PromoCTA, { type PromoCTAData } from '@/components/instagram/templates/PromoCTA'

import SharpPropsEditor from '@/components/instagram/editors/PlayerPropEditor'
import TeamInsiderEditor from '@/components/instagram/editors/TeamInsiderEditor'
import SeriesCoverEditor from '@/components/instagram/editors/SeriesCoverEditor'
import RankingsEditor from '@/components/instagram/editors/RankingsEditor'
import PromoCTAEditor from '@/components/instagram/editors/PromoCTAEditor'

// ── Types ──────────────────────────────────────────────────

type AspectRatio = '4:5' | '9:16'

type BuilderState = {
  activeTemplate: TemplateType
  aspectRatio: AspectRatio
  background: BackgroundSettings
  sharpProps: SharpPropData
  teamInsider: TeamInsiderData
  seriesCover: SeriesCoverData
  rankings: RankingsData
  promoCta: PromoCTAData
}

type Action =
  | { type: 'SET_TEMPLATE'; template: TemplateType }
  | { type: 'SET_ASPECT'; ratio: AspectRatio }
  | { type: 'UPDATE_BACKGROUND'; patch: Partial<BackgroundSettings> }
  | { type: 'UPDATE_SHARP_PROPS'; patch: Partial<SharpPropData> }
  | { type: 'UPDATE_TEAM_INSIDER'; patch: Partial<TeamInsiderData> }
  | { type: 'UPDATE_SERIES_COVER'; patch: Partial<SeriesCoverData> }
  | { type: 'UPDATE_RANKINGS'; patch: Partial<RankingsData> }
  | { type: 'UPDATE_PROMO_CTA'; patch: Partial<PromoCTAData> }

// ── Defaults ───────────────────────────────────────────────

const defaults: BuilderState = {
  activeTemplate: 'sharp-props',
  aspectRatio: '4:5',
  background: {
    imageUrl: null,
    positionX: 50,
    positionY: 50,
    overlayOpacity: 70,
    overlayColor: '#000000',
  },
  sharpProps: {
    sportLabel: 'NBA',
    playerName: 'Jalen Green',
    teamName: 'PHX | G',
    playerImageUrl: null,
    propLabel: 'Over 24.5 Points',
    predOdds: '-110',
    bookOdds: '-105',
    edge: '8.2%',
    score: '87',
    volume: '12',
    sources: 'Polymarket, Kalshi, Novig',
    metricBars: [
      { label: 'Pred', value: '-110', height: 72 },
      { label: 'Books', value: '-105', height: 60 },
      { label: 'Edge', value: '8.2%', height: 84 },
      { label: 'Score', value: '87', height: 76 },
    ],
  },
  teamInsider: {
    sportLabel: 'NBA',
    matchupTitle: 'LAL vs BOS',
    outcome: 'Lakers ML',
    teamImageUrl: null,
    insiderScore: '92',
    stakeUsd: '$5k',
    toWinUsd: '$4.5k',
    walletRoi: '+42%',
    sizeRatio: '3.2x',
    totalBets: '12',
    totalWagered: '$62k',
    odds: '-110',
    feedType: 'insider',
  },
  seriesCover: {
    seriesName: 'SPLASH FRIDAY',
    subtitle: '3PT Trends',
  },
  rankings: {
    headline: '83% HIT RATE THIS WEEK',
    entries: [
      { rank: 1, label: 'Jalen Brunson Over 22.5 Pts', value: 'W' },
      { rank: 2, label: 'Celtics -4.5', value: 'W' },
      { rank: 3, label: 'Lakers vs Nuggets Over 218', value: 'W' },
      { rank: 4, label: 'Timberwolves ML', value: 'L' },
    ],
    badgeText: 'DELTA SPORTS',
  },
  promoCta: {
    headline: 'Get Your Edge',
    ctaText: 'Try Free for 7 Days',
    subtitle: 'Find profitable bets by tracking sharp money',
  },
}

// ── Reducer ────────────────────────────────────────────────

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case 'SET_TEMPLATE':
      return { ...state, activeTemplate: action.template }
    case 'SET_ASPECT':
      return { ...state, aspectRatio: action.ratio }
    case 'UPDATE_BACKGROUND':
      return { ...state, background: { ...state.background, ...action.patch } }
    case 'UPDATE_SHARP_PROPS':
      return { ...state, sharpProps: { ...state.sharpProps, ...action.patch } }
    case 'UPDATE_TEAM_INSIDER':
      return { ...state, teamInsider: { ...state.teamInsider, ...action.patch } }
    case 'UPDATE_SERIES_COVER':
      return { ...state, seriesCover: { ...state.seriesCover, ...action.patch } }
    case 'UPDATE_RANKINGS':
      return { ...state, rankings: { ...state.rankings, ...action.patch } }
    case 'UPDATE_PROMO_CTA':
      return { ...state, promoCta: { ...state.promoCta, ...action.patch } }
    default:
      return state
  }
}

// ── Helpers ────────────────────────────────────────────────

const ASPECT_HEIGHTS: Record<AspectRatio, number> = {
  '4:5': 1350,
  '9:16': 1920,
}

const FRAME_WIDTH = 1080

/** Convert a File to a base64 data URL (works reliably with html-to-image) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Component ──────────────────────────────────────────────

export default function InstagramBuilderClient() {
  const [state, dispatch] = useReducer(reducer, defaults)
  const captureRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.4)

  const frameHeight = ASPECT_HEIGHTS[state.aspectRatio]

  // Compute preview scale from container width
  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 500
      setPreviewScale(Math.min(width / FRAME_WIDTH, 0.55))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Image upload helpers — use base64 data URLs so html-to-image can capture them
  const makeImageHandler = useCallback(
    (actionType: Action['type'], field: string) => async (file: File) => {
      if (!file.type.startsWith('image/')) return
      const dataUrl = await fileToDataUrl(file)
      dispatch({ type: actionType, patch: { [field]: dataUrl } } as Action)
    },
    []
  )

  const makeClearHandler = useCallback(
    (actionType: Action['type'], field: string) => () => {
      dispatch({ type: actionType, patch: { [field]: null } } as Action)
    },
    []
  )

  // Render the active template content
  const renderTemplate = () => {
    switch (state.activeTemplate) {
      case 'sharp-props':
        return <SharpPropsCard data={state.sharpProps} />
      case 'team-insider':
        return <TeamInsiderCard data={state.teamInsider} />
      case 'series-cover':
        return <SeriesCover data={state.seriesCover} />
      case 'rankings':
        return <RankingsAuthority data={state.rankings} />
      case 'promo-cta':
        return <PromoCTA data={state.promoCta} />
    }
  }

  // Render canvas content: background layer + template
  const renderCanvas = () => (
    <>
      <BackgroundLayer bg={state.background} />
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {renderTemplate()}
      </div>
    </>
  )

  // Render the active editor
  const renderEditor = () => {
    switch (state.activeTemplate) {
      case 'sharp-props':
        return (
          <SharpPropsEditor
            data={state.sharpProps}
            onChange={(patch) => dispatch({ type: 'UPDATE_SHARP_PROPS', patch })}
            onFile={makeImageHandler('UPDATE_SHARP_PROPS', 'playerImageUrl')}
            onClearImage={makeClearHandler('UPDATE_SHARP_PROPS', 'playerImageUrl')}
          />
        )
      case 'team-insider':
        return (
          <TeamInsiderEditor
            data={state.teamInsider}
            onChange={(patch) => dispatch({ type: 'UPDATE_TEAM_INSIDER', patch })}
            onFile={makeImageHandler('UPDATE_TEAM_INSIDER', 'teamImageUrl')}
            onClearImage={makeClearHandler('UPDATE_TEAM_INSIDER', 'teamImageUrl')}
          />
        )
      case 'series-cover':
        return (
          <SeriesCoverEditor
            data={state.seriesCover}
            onChange={(patch) => dispatch({ type: 'UPDATE_SERIES_COVER', patch })}
          />
        )
      case 'rankings':
        return (
          <RankingsEditor
            data={state.rankings}
            onChange={(patch) => dispatch({ type: 'UPDATE_RANKINGS', patch })}
          />
        )
      case 'promo-cta':
        return (
          <PromoCTAEditor
            data={state.promoCta}
            onChange={(patch) => dispatch({ type: 'UPDATE_PROMO_CTA', patch })}
          />
        )
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Instagram Image Builder</h1>
          <p className="text-sm text-white/50 mt-1">Create branded posts for social media</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── Left: Controls ─── */}
          <div className="w-full lg:w-[380px] flex-shrink-0 space-y-5 max-h-[90vh] overflow-y-auto pr-1">
            {/* Template picker */}
            <div>
              <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Template</label>
              <TemplatePicker
                active={state.activeTemplate}
                onChange={(t) => dispatch({ type: 'SET_TEMPLATE', template: t })}
              />
            </div>

            {/* Aspect ratio toggle */}
            <div>
              <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Aspect Ratio</label>
              <div className="flex gap-2">
                {(['4:5', '9:16'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => dispatch({ type: 'SET_ASPECT', ratio })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      state.aspectRatio === ratio
                        ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-400'
                        : 'border-white/10 text-white/50 hover:border-white/25'
                    }`}
                  >
                    {ratio}
                    <span className="block text-xs font-normal text-white/40">
                      {ratio === '4:5' ? 'Feed Post' : 'Story / Reel'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background image — shared across all templates */}
            <BackgroundEditor
              bg={state.background}
              onChange={(patch) => dispatch({ type: 'UPDATE_BACKGROUND', patch })}
              onFile={async (file) => {
                if (!file.type.startsWith('image/')) return
                const dataUrl = await fileToDataUrl(file)
                dispatch({ type: 'UPDATE_BACKGROUND', patch: { imageUrl: dataUrl, positionX: 50, positionY: 50 } })
              }}
              onClear={() => dispatch({ type: 'UPDATE_BACKGROUND', patch: { imageUrl: null } })}
            />

            {/* Template-specific editor */}
            <div>
              <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Customize</label>
              {renderEditor()}
            </div>

            {/* Export */}
            <ExportBar captureRef={captureRef} templateName={state.activeTemplate} />
          </div>

          {/* ─── Right: Preview ─── */}
          <div className="flex-1 min-w-0" ref={previewContainerRef}>
            <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Preview</label>
            <div
              className="rounded-xl border border-white/10 bg-black/30 overflow-hidden"
              style={{
                width: FRAME_WIDTH * previewScale,
                height: frameHeight * previewScale,
              }}
            >
              <div
                style={{
                  width: FRAME_WIDTH,
                  height: frameHeight,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <InstagramFrame height={frameHeight}>
                  {renderCanvas()}
                </InstagramFrame>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Off-screen capture (full resolution) ─── */}
      <ShareCaptureRoot>
        <div ref={captureRef}>
          <InstagramFrame height={frameHeight}>
            {renderCanvas()}
          </InstagramFrame>
        </div>
      </ShareCaptureRoot>
    </div>
  )
}
