import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json({ error: 'Bet settlement is disabled' }, { status: 410 })
}

export async function GET() {
  return NextResponse.json({ error: 'Bet settlement is disabled' }, { status: 410 })
}
