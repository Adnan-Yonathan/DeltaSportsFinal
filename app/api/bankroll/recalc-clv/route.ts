import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { subDays } from 'date-fns'
import { computeClvForBets } from '@/lib/services/clv'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'

    const now = new Date()
    let startDate: Date
    switch (period) {
      case '7d': startDate = subDays(now, 7); break
      case '30d': startDate = subDays(now, 30); break
      case 'all': default: startDate = new Date(0); break
    }

    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .gte('placed_at', startDate.toISOString())

    const { clvAgg, updates } = await computeClvForBets(bets || [])

    return NextResponse.json({ updated: updates.length, clv: clvAgg })
  } catch (error: any) {
    console.error('[CLV] Recalc error:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}
