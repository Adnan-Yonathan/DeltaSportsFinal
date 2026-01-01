import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('url')
    if (!target) {
      return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
    }

    const decoded = decodeURIComponent(target)
    if (!/^https?:\/\//i.test(decoded)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const upstream = await fetch(decoded, { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream fetch failed' }, { status: upstream.status })
    }

    const buffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    })
  } catch (err: any) {
    console.error('[image-proxy] error', err)
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 })
  }
}
