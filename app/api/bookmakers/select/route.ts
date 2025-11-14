import { NextRequest, NextResponse } from 'next/server'
import { selectBookmakersRemote } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const queryBookmakers = url.searchParams.get('bookmakers')
  let bodyBookmakers: string[] | undefined

  try {
    const payload = await req.json()
    if (Array.isArray(payload?.bookmakers)) {
      bodyBookmakers = payload.bookmakers
    }
  } catch (error) {
    // ignore body parse errors; we can still rely on query params
  }

  const bookmakers =
    bodyBookmakers ||
    (queryBookmakers ? queryBookmakers.split(',').map((book) => book.trim()).filter(Boolean) : undefined)

  if (!bookmakers || !bookmakers.length) {
    return NextResponse.json({ error: 'Provide at least one bookmaker' }, { status: 400 })
  }

  try {
    await selectBookmakersRemote(bookmakers)
    return NextResponse.json({
      message: 'Bookmakers updated successfully',
      count: bookmakers.length,
      bookmakers,
    })
  } catch (error: any) {
    console.error('[BOOKMAKERS_SELECT] Failed to select bookmakers:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to select bookmakers' },
      { status: error?.statusCode || 500 }
    )
  }
}
