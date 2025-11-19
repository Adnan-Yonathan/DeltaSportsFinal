#!/usr/bin/env node

/**
 * Lightweight fetcher that pulls ESPN live scores/summary data and caches them.
 * Stores JSON snapshots under cache/live so the LLM tools/prediction models can read them without hitting ESPN directly.
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const CACHE_DIR = path.join(ROOT, "cache", "live")
const MASTER_FILE = path.join(CACHE_DIR, "scores.json")

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`)
  }
  return res.json()
}

async function main() {
  const res = await fetch("http://localhost:3000/api/live-scores")
  if (!res.ok) {
    throw new Error(`Failed to hit local live-scores API: ${res.status}`)
  }

  const master = await res.json()
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(MASTER_FILE, JSON.stringify(master, null, 2))

  // Pre-fetch details for active games to warm cache
  const liveGames = master.games.filter((game) => game.bucket === "live")
  for (const game of liveGames) {
    const url = `http://localhost:3000/api/live-scores/${game.eventId}?league=${game.league}`
    try {
      const detailRes = await fetch(url)
      if (!detailRes.ok) {
        console.warn("Failed to fetch detail for", game.eventId)
        continue
      }
      const payload = await detailRes.json()
      fs.writeFileSync(path.join(CACHE_DIR, `${game.league}-${game.eventId}.json`), JSON.stringify(payload, null, 2))
    } catch (err) {
      console.warn("Detail fetch error", err)
    }
  }

  console.log(`Cached ${master.games.length} games into ${CACHE_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
