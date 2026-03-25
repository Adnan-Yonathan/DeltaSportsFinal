export const LAST_TOOL_COOKIE = 'delta_last_tool'
export const LAST_TOOL_LOCAL_STORAGE_KEY = 'delta_last_tool'

export const DEFAULT_TOOL_ROUTE = '/market-projections'

export const TOOL_ROUTE_PREFIXES = [
  '/market-projections',
  '/odds-screen',
  '/sharp-props',
  '/sharp-detector',
  '/research',
  '/calculators',
  '/docs',
  '/socials',
  '/blog',
  '/live-projections',
  '/line-shopping',
  '/player-prop-odds',
  '/parlay-predictor',
  '/stats',
] as const

const normalizePathname = (pathname: string) => {
  const [pathOnly] = pathname.split('?')
  const [withoutHash] = pathOnly.split('#')
  if (!withoutHash) return '/'
  return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`
}

export const isToolRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname)
  return TOOL_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  )
}

export const sanitizeToolRoute = (pathname?: string | null) => {
  if (!pathname) return DEFAULT_TOOL_ROUTE
  const normalized = normalizePathname(pathname)
  return isToolRoute(normalized) ? normalized : DEFAULT_TOOL_ROUTE
}
