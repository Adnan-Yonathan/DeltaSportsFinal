import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: affiliateRows } = await service
      .from("affiliates" as any)
      .select("code")
      .eq("user_id", user.id)
      .limit(1)

    if (!affiliateRows || affiliateRows.length === 0) {
      return NextResponse.json({ error: "No affiliate profile" }, { status: 400 })
    }

    const code = affiliateRows[0].code as string
    const { data: earnedRows } = await service
      .from("affiliate_attributions" as any)
      .select("amount_cents")
      .eq("code", code)
      .in("status", ["earned"])

    const earnedCents = (earnedRows || []).reduce(
      (sum: number, row: { amount_cents?: number }) => sum + (row.amount_cents || 0),
      0
    )

    if (earnedCents <= 0) {
      return NextResponse.json(
        { error: "No earned balance available" },
        { status: 400 }
      )
    }

    const periodStart = startOfMonth(new Date()).toISOString()
    const { data: existing } = await service
      .from("affiliate_payout_requests" as any)
      .select("id")
      .eq("affiliate_code", code)
      .eq("status", "pending")
      .gte("created_at", periodStart)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Payout request already submitted this month" },
        { status: 409 }
      )
    }

    const { error } = await service
      .from("affiliate_payout_requests" as any)
      .insert({
        affiliate_code: code,
        user_id: user.id,
        amount_cents: earnedCents,
        status: "pending",
      })

    if (error) {
      return NextResponse.json(
        { error: "Failed to submit payout request" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[AFFILIATE] Payout request failed:", error)
    return NextResponse.json(
      { error: "Failed to submit payout request" },
      { status: 500 }
    )
  }
}
