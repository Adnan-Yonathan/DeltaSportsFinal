import fs from "fs"
import path from "path"
import type { LiveScoresResponse, LiveScoreGameDetails } from "./live-scores"
import type { LiveGameState } from "@/lib/services/live-game-analyzer"

const CACHE_ROOT = path.join(process.cwd(), "cache", "live")
const ANALYSIS_ROOT = path.join(CACHE_ROOT, "analysis")
const MASTER_FILE = path.join(CACHE_ROOT, "scores.json")
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const isFresh = (filePath: string, ttlMs: number) => {
  try {
    const stats = fs.statSync(filePath)
    return Date.now() - stats.mtimeMs < ttlMs
  } catch {
    return false
  }
}

const readJson = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn("[live-cache] read error", filePath, error)
    return null
  }
}

export const loadCachedScores = (opts?: { ttlMs?: number }): LiveScoresResponse | null => {
  const ttlMs = opts?.ttlMs ?? CACHE_TTL_MS
  if (!fs.existsSync(MASTER_FILE) || !isFresh(MASTER_FILE, ttlMs)) return null
  return readJson<LiveScoresResponse>(MASTER_FILE)
}

export const saveCachedScores = (data: LiveScoresResponse) => {
  ensureDir(CACHE_ROOT)
  fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2))
}

export const loadCachedGameDetails = (
  league: string,
  eventId: string,
  opts?: { ttlMs?: number }
): LiveScoreGameDetails | null => {
  const ttlMs = opts?.ttlMs ?? CACHE_TTL_MS
  const filePath = path.join(CACHE_ROOT, `${league}-${eventId}.json`)
  if (!fs.existsSync(filePath) || !isFresh(filePath, ttlMs)) return null
  return readJson<LiveScoreGameDetails>(filePath)
}

export const saveCachedGameDetails = (
  league: string,
  eventId: string,
  data: LiveScoreGameDetails
) => {
  try {
    ensureDir(CACHE_ROOT)
    const filePath = path.join(CACHE_ROOT, `${league}-${eventId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.warn("[live-cache] save game details failed", error)
  }
}

export const loadCachedAnalysis = (
  league: string,
  eventId: string,
  opts?: { ttlMs?: number }
): LiveGameState | null => {
  const ttlMs = opts?.ttlMs ?? CACHE_TTL_MS
  const filePath = path.join(ANALYSIS_ROOT, `${league}-${eventId}.json`)
  if (!fs.existsSync(filePath) || !isFresh(filePath, ttlMs)) return null
  return readJson<LiveGameState>(filePath)
}

export const saveCachedAnalysis = (
  league: string,
  eventId: string,
  data: LiveGameState
) => {
  try {
    ensureDir(ANALYSIS_ROOT)
    const filePath = path.join(ANALYSIS_ROOT, `${league}-${eventId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.warn("[live-cache] save analysis failed", error)
  }
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
