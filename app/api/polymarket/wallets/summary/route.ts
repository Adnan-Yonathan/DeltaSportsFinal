import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limitValue = Number(limitParam ?? 50)
  const walletsParam = searchParams.get('wallets')
  const wallets = walletsParam
    ? walletsParam
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : []
  const defaultLimit = Number.isFinite(limitValue) ? limitValue : 50
  const requestedLimit = limitParam ? defaultLimit : wallets.length || defaultLimit
  const finalLimit = Math.min(requestedLimit, 200)

  const supabase = createServiceClient()
  let query = supabase
    .from('polymarket_wallet_summary' as any)
    .select(
      'wallet, total_realized_pnl, total_wins, total_losses, total_pushes, last_computed_at'
    )
  if (wallets.length) {
    query = query.in('wallet', wallets)
  }
  const { data, error } = await query
    .order('total_realized_pnl', { ascending: false })
    .limit(finalLimit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wallets: data ?? [] })
}
