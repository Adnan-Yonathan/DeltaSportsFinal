const NFL_DRAFT_SLUG_HINT = /(?:^|-)pro-football-draft(?:-|$)|(?:^|-)nfl-draft(?:-|$)|(?:^|-)football-draft(?:-|$)/
const NFL_DRAFT_TEXT_HINT = /\b(?:nfl|pro football|football)\s+draft\b/i

export const normalizePolymarketDraftText = (value?: string | null) =>
  String(value ?? '').toLowerCase().trim()

export const isNflDraftPolymarketMarket = (value?: string | null): boolean => {
  const normalized = normalizePolymarketDraftText(value)
  if (!normalized) return false
  return NFL_DRAFT_SLUG_HINT.test(normalized) || NFL_DRAFT_TEXT_HINT.test(String(value ?? ''))
}

export type DraftSportEventLike = {
  category?: string | null
  title?: string | null
  seriesSlug?: string | null
  series?: Array<{ slug?: string | null; title?: string | null }>
  tags?: Array<{ slug?: string | null; label?: string | null }>
}

export const resolveNflDraftSportKeyFromPolymarketEvent = (
  event: DraftSportEventLike
): 'nfl' | null => {
  const values = [
    event.title,
    event.seriesSlug,
    ...(event.series ?? []).flatMap((entry) => [entry?.slug, entry?.title]),
    ...(event.tags ?? []).flatMap((tag) => [tag?.slug, tag?.label]),
  ]
  return values.some(isNflDraftPolymarketMarket) ? 'nfl' : null
}
