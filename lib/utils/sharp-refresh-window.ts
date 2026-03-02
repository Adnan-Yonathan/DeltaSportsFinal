const EASTERN_TIME_ZONE = "America/New_York"
const OPEN_WINDOW_START_MINUTES = 10 * 60 // 10:00 AM ET
const OPEN_WINDOW_END_MINUTES = 30 // 12:30 AM ET (next day)

const EASTERN_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export const SHARP_REFRESH_INTERVAL_MS = 30 * 60 * 1000
export const SHARP_REFRESH_WINDOW_LABEL = "10:00 AM-12:30 AM ET"

export const getEasternMinutesOfDay = (date = new Date()) => {
  try {
    const parts = EASTERN_TIME_FORMATTER.formatToParts(date)
    const hour = Number(parts.find((part) => part.type === "hour")?.value)
    const minute = Number(parts.find((part) => part.type === "minute")?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
  } catch {
    return null
  }
}

export const isWithinSharpRefreshWindow = (date = new Date()) => {
  const easternMinutes = getEasternMinutesOfDay(date)
  if (easternMinutes == null) return true
  return (
    easternMinutes >= OPEN_WINDOW_START_MINUTES ||
    easternMinutes < OPEN_WINDOW_END_MINUTES
  )
}

