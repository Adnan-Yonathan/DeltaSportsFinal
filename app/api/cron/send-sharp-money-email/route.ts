import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchWhaleTrades } from "@/lib/services/whale-detector"

export const dynamic = "force-dynamic"

const RESEND_API_URL = "https://api.resend.com/emails"
const MIN_NOTIONAL = 2000
const MAX_LIMIT = 250

type WhaleTrade = Awaited<ReturnType<typeof fetchWhaleTrades>>[number]

const formatOddsLabel = (priceCents: number, americanOdds: number | null) => {
  const centsLabel = `${priceCents}c`
  if (americanOdds == null) return centsLabel
  const sign = americanOdds >= 0 ? "+" : ""
  return `${centsLabel} (${sign}${americanOdds})`
}

const formatDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const buildEmailText = (trade: WhaleTrade) => {
  const matchup = trade.marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()
  const eventDate = trade.eventDate ? formatDate(trade.eventDate) : formatDate(trade.timestamp)
  return [
    "Delta Sports - Sharp Money Pick of the Day",
    "",
    `Sport: ${trade.sport}`,
    `Date: ${eventDate}`,
    `Market: ${matchup}`,
    `Bet: ${trade.outcome}`,
    `Odds: ${formatOddsLabel(trade.priceCents, trade.americanOdds)}`,
    `Size: $${Math.round(trade.notional).toLocaleString()}`,
    `Source: ${trade.source === "kalshi" ? "Kalshi" : "Polymarket"}`,
    "",
    "Track more sharp money at https://deltasports.app",
  ].join("\n")
}

const buildEmailHtml = (trade: WhaleTrade) => {
  const matchup = trade.marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()
  const eventDate = trade.eventDate ? formatDate(trade.eventDate) : formatDate(trade.timestamp)
  return `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Delta Sports - Sharp Money Pick of the Day</h2>
      <p><strong>Sport:</strong> ${trade.sport}</p>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Market:</strong> ${matchup}</p>
      <p><strong>Bet:</strong> ${trade.outcome}</p>
      <p><strong>Odds:</strong> ${formatOddsLabel(trade.priceCents, trade.americanOdds)}</p>
      <p><strong>Size:</strong> $${Math.round(trade.notional).toLocaleString()}</p>
      <p><strong>Source:</strong> ${trade.source === "kalshi" ? "Kalshi" : "Polymarket"}</p>
      <p style="margin-top: 20px;">
        Track more sharp money at <a href="https://deltasports.app">deltasports.app</a>
      </p>
    </div>
  `
}

const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL
    if (!resendApiKey || !fromEmail) {
      return NextResponse.json({ error: "Missing email configuration" }, { status: 500 })
    }

    const supabase = createServiceClient()
    const { data: optins, error } = await supabase
      .from("email_optins" as any)
      .select("id, email, last_sent_at")
      .eq("status", "active")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!optins || optins.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const trades = await fetchWhaleTrades({ minNotional: MIN_NOTIONAL, limit: MAX_LIMIT })
    const sharpTrades = trades.filter(
      (trade: WhaleTrade) => trade.isUltraSharp === true && (trade.sharpStrength ?? 0) > 55
    )
    if (sharpTrades.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no_sharp_trades" })
    }

    const pick = sharpTrades[Math.floor(Math.random() * sharpTrades.length)]
    const emailText = buildEmailText(pick)
    const emailHtml = buildEmailHtml(pick)

    const today = new Date()
    const eligible = optins.filter((row: any) => {
      if (!row.last_sent_at) return true
      const last = new Date(row.last_sent_at)
      return !isSameDate(last, today)
    })

    let sentCount = 0
    for (const row of eligible) {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: row.email,
          subject: "Sharp Money Pick of the Day",
          text: emailText,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        continue
      }

      sentCount += 1
      await supabase
        .from("email_optins" as any)
        .update({
          last_sent_at: new Date().toISOString(),
          last_trade_id: pick.id,
        } as any)
        .eq("id", row.id)
    }

    return NextResponse.json({ ok: true, sent: sentCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
