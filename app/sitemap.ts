import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import {
  buildBlogPath,
  buildSlatePath,
  formatEdgeDate,
} from '@/lib/blog/market-projections'

const BASE_URL = 'https://deltasports.app'

const ROUTES = [
  '/',
  '/about',
  '/blog',
  '/sharp-betting-tools',
  '/pricing',
  '/tools',
  '/live-scores',
  '/market-projections',
  '/player-prop-odds',
  '/player-projections',
  '/parlay-predictor',
  '/sharp-traders',
  '/live-projections',
  '/sharp-detector',
  '/stats',
  '/promos',
  '/patch-notes',
  '/models',
  '/affiliate',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const entries: MetadataRoute.Sitemap = ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
  }))

  try {
    const supabase = createServiceClient()
    const { data } = (await supabase
      .from('market_projections_cache' as any)
      .select('sport, edges, updated_at')) as unknown as {
      data: Array<{ sport: string; edges: GameEdgeAnalysis[]; updated_at: string }> | null
    }

    const slateKeys = new Set<string>()
    for (const row of data ?? []) {
      for (const edge of row.edges ?? []) {
        if (!edge?.homeTeam || !edge?.awayTeam) continue
        const date = formatEdgeDate(edge)
        if (!date) continue
        const blogPath = buildBlogPath(row.sport, date, edge.awayTeam, edge.homeTeam)
        entries.push({
          url: `${BASE_URL}${blogPath}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : lastModified,
        })
        const slateKey = `${row.sport}|${date}`
        if (!slateKeys.has(slateKey)) {
          slateKeys.add(slateKey)
          entries.push({
            url: `${BASE_URL}${buildSlatePath(row.sport, date)}`,
            lastModified: row.updated_at ? new Date(row.updated_at) : lastModified,
          })
        }
      }
    }
  } catch {
    // Keep base routes only if projections are unavailable.
  }

  return entries
}
