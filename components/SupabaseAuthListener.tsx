"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/supabase/types"

export function SupabaseAuthListener() {
  const router = useRouter()
  const supabase = useMemo(() => createClientComponentClient<Database>(), [])
  const lastSyncedTokenRef = useRef<string | null>(null)
  const lastCallbackKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!event) return

      const accessToken = session?.access_token ?? null

      if (event === "INITIAL_SESSION") {
        lastSyncedTokenRef.current = accessToken
        return
      }

      if (
        event !== "SIGNED_IN" &&
        event !== "TOKEN_REFRESHED" &&
        event !== "SIGNED_OUT"
      ) {
        return
      }

      if (event !== "SIGNED_OUT" && accessToken === lastSyncedTokenRef.current) {
        return
      }

      const callbackKey = `${event}:${accessToken ?? "signed-out"}`
      if (callbackKey === lastCallbackKeyRef.current) {
        return
      }

      lastCallbackKeyRef.current = callbackKey
      lastSyncedTokenRef.current = accessToken

      void fetch("/auth/callback", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({ event, session }),
      })
        .then(() => {
          if (event !== "TOKEN_REFRESHED") {
            router.refresh()
          }
        })
        .catch(() => {
          lastCallbackKeyRef.current = null
        })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}
