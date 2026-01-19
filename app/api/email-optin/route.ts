import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const source = typeof body?.source === "string" ? body.source.trim() : "unknown"
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("email_optins" as any)
      .upsert(
        [
          {
            email: rawEmail,
            source,
            status: "active",
          },
        ] as any,
        { onConflict: "email" } as any
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
