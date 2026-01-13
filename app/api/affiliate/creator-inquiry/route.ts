import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

type CreatorInquiryPayload = {
  name: string
  creatorType: "ugc" | "creator"
  socialAccounts: string
  followersEstimate?: number | null
  viewsPerMonth?: number | null
  expectedPay?: string | null
  phone?: string | null
}

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatorInquiryPayload
    if (!body.name || !body.creatorType || !body.socialAccounts) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const service = createServiceClient()
    const { error } = await service.from("creator_inquiries" as any).insert([
      {
        name: body.name.trim(),
        creator_type: body.creatorType,
        social_accounts: body.socialAccounts.trim(),
        followers_estimate: toNumberOrNull(body.followersEstimate),
        views_per_month: toNumberOrNull(body.viewsPerMonth),
        expected_pay: body.expectedPay?.trim() || null,
        phone: body.phone?.trim() || null,
      },
    ] as any)

    if (error) {
      console.error("[AFFILIATE] Creator inquiry insert failed:", error)
      return NextResponse.json(
        { error: "Failed to submit inquiry" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[AFFILIATE] Creator inquiry failed:", error)
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 }
    )
  }
}
