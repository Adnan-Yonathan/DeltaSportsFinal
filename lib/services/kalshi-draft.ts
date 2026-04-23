const NFL_DRAFT_TICKER_HINT =
  /(?:^|[-_])(?:nfldraft|nfl-draft|profootballdraft|pro-football-draft|footballdraft|football-draft)(?:[-_]|$)|(?:^|[-_])(?:kxnfldraft|kxnfl-draft)(?:[-_]|$)/i
const NFL_DRAFT_TEXT_HINT = /\b(?:nfl|pro football|football)\s+draft\b/i

export const normalizeKalshiDraftText = (value?: string | null) =>
  String(value ?? '').trim()

export const isNflDraftKalshiMarket = (...values: Array<string | null | undefined>): boolean => {
  return values.some((value) => {
    const normalized = normalizeKalshiDraftText(value)
    if (!normalized) return false
    return NFL_DRAFT_TICKER_HINT.test(normalized) || NFL_DRAFT_TEXT_HINT.test(normalized)
  })
}

export const resolveNflDraftKalshiSport = (
  ...values: Array<string | null | undefined>
): 'NFL' | null => {
  return isNflDraftKalshiMarket(...values) ? 'NFL' : null
}

export const resolveKalshiDraftEventDate = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    const raw = String(value ?? '').trim()
    if (!raw) continue
    const parsed = Date.parse(raw)
    if (!Number.isFinite(parsed)) continue
    return new Date(parsed).toISOString()
  }
  return undefined
}
