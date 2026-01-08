import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { findEVOpportunities } from "@/lib/services/cross-market-ev"
import { SPORTS } from "@/lib/types/odds"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess =
    membership.isActive &&
    (membership.tier === "sharp" || membership.tier === "syndicate")

  if (!hasAccess) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required." },
      { status: 403 }
    )
  }

  try {
    const opportunities = await findEVOpportunities({
      includeProps: true,
      minPropEV: 0,
      limit: 200,
      slateMode: "next",
      sports: Object.values(SPORTS),
    })

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      data: opportunities,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load EV bets."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
