import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const CODE_LENGTH = 8
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const generateCode = () => {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
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
    const { data: existing } = await service
      .from("affiliates" as any)
      .select("code")
      .eq("user_id", user.id)
      .limit(1)
    const existingRows = (existing ?? []) as Array<{ code: string }>

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"

    if (existingRows.length > 0) {
      const code = existingRows[0].code
      return NextResponse.json({
        code,
        link: `${origin}/?ref=${code}`,
      })
    }

    let code = ""
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateCode()
      const { data, error } = await service
        .from("affiliates" as any)
        .insert([{ user_id: user.id, code: candidate }] as any)
        .select("code")
        .single()

      const dataRow = (data ?? null) as { code?: string } | null
      if (!error && dataRow?.code) {
        code = dataRow.code
        break
      }

      if (error && error.code !== "23505") {
        throw error
      }
    }

    if (!code) {
      return NextResponse.json(
        { error: "Failed to generate affiliate code" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      code,
      link: `${origin}/?ref=${code}`,
    })
  } catch (error) {
    console.error("[AFFILIATE] Link generation failed:", error)
    return NextResponse.json(
      { error: "Failed to generate affiliate link" },
      { status: 500 }
    )
  }
}
