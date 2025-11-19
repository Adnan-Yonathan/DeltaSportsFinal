import fs from "fs"
import path from "path"
import type { LiveScoresResponse, LiveScoreGameDetails } from "./live-scores"

const CACHE_ROOT = path.join(process.cwd(), "cache", "live")
const MASTER_FILE = path.join(CACHE_ROOT, "scores.json")

const readJson = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn("[live-cache] read error", filePath, error)
    return null
  }
}

export const loadCachedScores = (): LiveScoresResponse | null => {
  if (!fs.existsSync(MASTER_FILE)) return null
  return readJson<LiveScoresResponse>(MASTER_FILE)
}

export const loadCachedGameDetails = (league: string, eventId: string): LiveScoreGameDetails | null => {
  const filePath = path.join(CACHE_ROOT, `${league}-${eventId}.json`)
  if (!fs.existsSync(filePath)) return null
  return readJson<LiveScoreGameDetails>(filePath)
}

export const listCacheMeta = () => {
  if (!fs.existsSync(CACHE_ROOT)) {
    return []
  }
  return fs
    .readdirSync(CACHE_ROOT)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const full = path.join(CACHE_ROOT, file)
      const stats = fs.statSync(full)
      return { file, updatedAt: stats.mtime.toISOString() }
    })
}
