const US_MARKET_TIME_ZONE = 'America/New_York'
const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/

const US_MARKET_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: US_MARKET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const getUsMarketDayKey = (date = new Date()) => {
  try {
    const value = US_MARKET_DAY_FORMATTER.format(date)
    if (DATE_PREFIX_PATTERN.test(value)) return value
  } catch {}
  return date.toISOString().slice(0, 10)
}

export const resolveEventDayKey = (value?: string | null) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const match = raw.match(DATE_PREFIX_PATTERN)
  if (match?.[0]) return match[0]

  const parsed = new Date(raw)
  if (!Number.isFinite(parsed.getTime())) return null
  return getUsMarketDayKey(parsed)
}

export const isUpcomingEventDate = (
  value?: string | null,
  todayKey: string = getUsMarketDayKey()
) => {
  const eventDayKey = resolveEventDayKey(value)
  if (!eventDayKey) return true
  return eventDayKey >= todayKey
}

export const filterUpcomingEventItems = <T extends { eventDate?: string | null }>(
  items: T[],
  todayKey: string = getUsMarketDayKey()
) => items.filter((item) => isUpcomingEventDate(item.eventDate, todayKey))
