import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const normalizeWallet = (wallet: string) => wallet.trim().toLowerCase()

const parseWalletFromBody = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const rawWallet = typeof body?.wallet === 'string' ? body.wallet : ''
  const wallet = normalizeWallet(rawWallet)
  if (!wallet || wallet.length < 6) {
    return null
  }
  return wallet
}

export async function GET() {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('polymarket_user_tracked_wallets')
    .select('wallet')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to load tracked wallets' }, { status: 500 })
  }

  return NextResponse.json({ wallets: data?.map((row: { wallet: string }) => row.wallet) ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = await parseWalletFromBody(req)
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('polymarket_user_tracked_wallets')
    .upsert({ user_id: user.id, wallet })

  if (error) {
    return NextResponse.json({ error: 'Failed to track wallet' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = await parseWalletFromBody(req)
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('polymarket_user_tracked_wallets')
    .delete()
    .eq('user_id', user.id)
    .eq('wallet', wallet)

  if (error) {
    return NextResponse.json({ error: 'Failed to untrack wallet' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
