import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('polymarket_wallet_summary' as any)
    .select(
      'wallet, total_realized_pnl, total_wins, total_losses, total_pushes, last_computed_at'
    )
    .order('total_realized_pnl', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wallets: data ?? [] })
}
