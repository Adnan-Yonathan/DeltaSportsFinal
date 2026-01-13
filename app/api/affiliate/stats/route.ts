import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
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
      .select("code, status, created_at")
      .eq("user_id", user.id)
      .limit(1)

    if (!affiliateRows || affiliateRows.length === 0) {
      return NextResponse.json({
        hasAffiliate: false,
        totals: {
          clicks: 0,
          pendingCount: 0,
          earnedCount: 0,
          pendingCents: 0,
          earnedCents: 0,
        },
        attributions: [],
      })
    }

    const affiliate = affiliateRows[0]
    const code = affiliate.code as string

    const { count: clickCount } = await service
      .from("affiliate_clicks" as any)
      .select("id", { count: "exact", head: true })
      .eq("code", code)

    const { data: attributions } = await service
      .from("affiliate_attributions" as any)
      .select("status, amount_cents, converted_at, created_at, trial_end_at")
      .eq("code", code)
      .order("created_at", { ascending: false })

    const totals = {
      clicks: clickCount ?? 0,
      pendingCount: 0,
      earnedCount: 0,
      pendingCents: 0,
      earnedCents: 0,
    }

    for (const attribution of attributions ?? []) {
      if (attribution.status === "earned" || attribution.status === "paid") {
        totals.earnedCount += 1
        totals.earnedCents += attribution.amount_cents || 0
      } else if (attribution.status === "pending") {
        totals.pendingCount += 1
        totals.pendingCents += attribution.amount_cents || 0
      }
    }

    return NextResponse.json({
      hasAffiliate: true,
      affiliate: {
        code,
        status: affiliate.status,
        createdAt: affiliate.created_at,
      },
      totals,
      attributions: attributions ?? [],
    })
  } catch (error) {
    console.error("[AFFILIATE] Stats fetch failed:", error)
    return NextResponse.json(
      { error: "Failed to load affiliate stats" },
      { status: 500 }
    )
  }
}
