const MIN_TOKEN_LENGTH = 3

export const normalizeTeamTokens = (tokens: string[] = []) => {
  const seen = new Set<string>()
  tokens.forEach((raw) => {
    const t = raw.trim().toLowerCase()
    if (t && t.length >= MIN_TOKEN_LENGTH) {
      seen.add(t)
    }
  })
  return Array.from(seen)
}

export const hasRelevantTeamMentions = (text: string, teamTokenBuckets: string[][]): boolean => {
  if (!teamTokenBuckets.length) return false
  const requiredMatches = Math.min(2, teamTokenBuckets.length) // require both sides for normal matchups
  const lower = text.toLowerCase()
  let matchedTeams = 0
  for (const bucket of teamTokenBuckets) {
    const normalized = normalizeTeamTokens(bucket)
    if (normalized.some((token) => lower.includes(token))) {
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
    team.conferenceAbbr,
    team.conferenceName,
    ...(team.name ? team.name.split(/\s+/) : []),
    ...(team.shortName ? team.shortName.split(/\s+/) : []),
  ]
  return tokens.filter(Boolean) as string[]
}
