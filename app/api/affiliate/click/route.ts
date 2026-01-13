import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createHash } from "crypto"

export const dynamic = "force-dynamic"

const hashValue = (value: string) =>
  createHash("sha256").update(value).digest("hex")

export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json()) as { code?: string }
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: affiliate } = await service
      .from("affiliates" as any)
      .select("code")
      .eq("code", code)
      .limit(1)

    if (!affiliate || affiliate.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const forwardedFor = req.headers.get("x-forwarded-for") || ""
    const ip = forwardedFor.split(",")[0]?.trim() || "unknown"
    const userAgent = req.headers.get("user-agent") || "unknown"

    await service.from("affiliate_clicks" as any).insert([
      {
        code,
        session_id: req.cookies.get("affiliate_session")?.value ?? null,
        ip_hash: ip ? hashValue(ip) : null,
        user_agent_hash: userAgent ? hashValue(userAgent) : null,
      },
    ] as any)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[AFFILIATE] Click tracking failed:", error)
    return NextResponse.json({ ok: true })
  }
}
