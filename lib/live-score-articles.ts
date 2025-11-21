const MIN_TOKEN_LENGTH = 4
const STOPWORDS = new Set([
  "team",
  "state",
  "university",
  "college",
  "men",
  "women",
  "football",
  "basketball",
  "club",
])

export const normalizeTeamTokens = (tokens: string[] = []) => {
  const seen = new Set<string>()
  tokens.forEach((raw) => {
    const t = raw.trim().toLowerCase()
    if (t && t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t)) {
      seen.add(t)
    }
  })
  return Array.from(seen)
}

export const hasRelevantTeamMentions = (text: string, teamTokenBuckets: string[][]): boolean => {
  if (teamTokenBuckets.length < 2) return false
  const normalizedBuckets = teamTokenBuckets
    .map((bucket) => normalizeTeamTokens(bucket))
    .filter((bucket) => bucket.length)
  if (normalizedBuckets.length < 2) return false
  const requiredMatches = 2
  const lower = text.toLowerCase()
  let matchedTeams = 0
  for (const bucket of normalizedBuckets) {
    if (bucket.some((token) => lower.includes(token))) {
      matchedTeams++
      if (matchedTeams >= requiredMatches) return true
    }
  }
  return false
}

export const buildTeamTokenBucket = (team?: Partial<{ name?: string; shortName?: string; abbreviation?: string; conferenceAbbr?: string; conferenceName?: string }>) => {
  if (!team) return [] as string[]
  const tokens = [
    team.name,
    team.shortName,
    team.abbreviation,
    ...(team.name ? team.name.split(/\s+/) : []),
    ...(team.shortName ? team.shortName.split(/\s+/) : []),
  ]
  return tokens.filter(Boolean) as string[]
}

export const isPreviewArticle = (item: any): boolean => {
  const typeFields = [
    item?.type,
    item?.subType,
    item?.articleType,
    item?.articleType?.type,
    item?.category,
  ]
    .map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
    .filter(Boolean)
  if (typeFields.some((t) => t.includes("preview"))) return true

  const text = `${item?.headline || ""} ${item?.title || ""} ${item?.description || ""}`.toLowerCase()
  const previewSignals = ["preview", "matchup", "odds", "prediction", "how to watch", "vs.", " vs ", " at "]
  return previewSignals.some((signal) => text.includes(signal))
}
