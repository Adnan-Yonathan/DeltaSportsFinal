import type { MetadataRoute } from 'next'

const BASE_URL = 'https://deltasports.app'

const ROUTES = [
  '/',
  '/about',
  '/sharp-betting-tools',
  '/pricing',
  '/tools',
  '/live-scores',
  '/market-projections',
  '/player-projections',
  '/parlay-predictor',
  '/ev-bets',
  '/live-projections',
  '/sharp-detector',
  '/stats',
  '/promos',
  '/patch-notes',
  '/models',
  '/affiliate',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
  }))
}
