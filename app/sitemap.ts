import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import {
  buildBlogPath,
  formatEdgeDate,
} from '@/lib/blog/market-projections'
import { CORE_TOOLS } from '@/lib/core-tools'
import { SEO_BLOG_TOPICS } from '@/lib/blog/seo-topics'
import { COMPETITORS } from '@/lib/blog/competitor-data'

const BASE_URL = 'https://deltasports.app'

const PUBLIC_ROUTES = [
  '/',
  '/blog',
  '/pricing',
  '/tools',
  '/calculators',
  '/socials',
  '/sharp-betting-tools',
  '/vs',
  '/oddsjam-alternative',
  '/market-projections',
  '/sharp-props',
  '/sharp-detector',
  '/sharp-money-feed',
  '/line-shopping',
  '/player-prop-odds',
  '/live-scores',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const guideRoutes = CORE_TOOLS.map((tool) => tool.guideRoute)
  const insightRoutes = SEO_BLOG_TOPICS.map((topic) => `/blog/insights/${topic.slug}`)
  const competitorRoutes = COMPETITORS.map((c) => `/vs/${c.slug}`)
  const entries: MetadataRoute.Sitemap = [...PUBLIC_ROUTES, ...guideRoutes, ...insightRoutes, ...competitorRoutes].map((route) => ({
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
      }
    }
  } catch {
    // Keep base routes only if projections are unavailable.
  }

  return entries
}
