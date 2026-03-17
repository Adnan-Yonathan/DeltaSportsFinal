import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
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

    // Only include game blog posts that have been generated and persisted.
    // Do NOT include upcoming games from the live cache — those URLs don't exist
    // until a page render saves them, and Google crawling them before that
    // (which can take days) produces 404s that pollute the index.
    const { data: savedPosts } = await (supabase as any)
      .from('blog_game_posts')
      .select('sport, date, slug, updated_at')
      .order('date', { ascending: false })
      .limit(1000)

    for (const post of savedPosts ?? []) {
      entries.push({
        url: `${BASE_URL}/blog/${post.sport}/${post.date}/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : lastModified,
      })
    }
  } catch {
    // Keep base routes only if projections are unavailable.
  }

  return entries
}
