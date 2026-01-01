"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/supabase/types"
import mixpanel from "mixpanel-browser"

export function SupabaseAuthListener() {
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!event || event === "INITIAL_SESSION") return
      if (event === "SIGNED_IN" && session?.user?.id) {
        const user = session.user
        const loginMethod = user.app_metadata?.provider || "unknown"
        const isSignup =
          user.created_at &&
          user.last_sign_in_at &&
          user.created_at === user.last_sign_in_at
        mixpanel.identify(user.id)
        if (user.email) mixpanel.people.set({ $email: user.email })
        if (isSignup) {
          mixpanel.track("Sign Up", {
            user_id: user.id,
            email: user.email,
            signup_method: loginMethod,
          })
        }
        mixpanel.track("Sign In", {
          user_id: user.id,
          login_method: loginMethod,
          success: true,
        })
      }

      await fetch("/auth/callback", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({ event, session }),
      })

      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}
