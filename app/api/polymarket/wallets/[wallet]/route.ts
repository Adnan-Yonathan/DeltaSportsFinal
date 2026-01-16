import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: Request,
  { params }: { params: { wallet: string } }
) {
  const wallet = params.wallet?.toLowerCase()
  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: summary } = await supabase
    .from('polymarket_wallet_summary' as any)
    .select(
      'wallet, total_realized_pnl, total_wins, total_losses, total_pushes, last_computed_at'
    )
    .eq('wallet', wallet)
    .maybeSingle()

  const { data: daily } = await supabase
    .from('polymarket_wallet_daily_pnl' as any)
    .select('pnl_date, realized_pnl, wins, losses, pushes')
    .eq('wallet', wallet)
    .order('pnl_date', { ascending: false })
    .limit(60)

  const { data: markets } = await supabase
    .from('polymarket_wallet_market_results' as any)
    .select('slug, result, realized_pnl, resolved_at, net_winning_shares, net_losing_shares')
    .eq('wallet', wallet)
    .order('resolved_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    wallet,
    summary: summary ?? null,
    daily: daily ?? [],
    markets: markets ?? [],
  })
}
