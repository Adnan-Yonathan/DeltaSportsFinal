"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { useRouter } from "next/navigation"
import {
  CanvasRevealEffect,
  MiniNavbar,
} from "@/components/ui/sign-in-flow-1"

export const LoginPage = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClient()
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    setError("")
    setOauthLoading(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message || "Failed to sign in with Google")
      setOauthLoading(false)
    }
  }

  const isBusy = loading || oauthLoading

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || oauthLoading) {
      return
    }
    setLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const forceOnboarding =
          process.env.NEXT_PUBLIC_FORCE_ONBOARDING === "true"
        if (forceOnboarding) {
          router.push("/onboarding")
          return
        }

        const metadataCompleted = Boolean(
          (data.user.user_metadata as any)?.onboarding_completed
        )

        if (!metadataCompleted) {
          const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("onboarding_completed")
            .eq("id", data.user.id)
            .single()

          if (!profileError && profile?.onboarding_completed === false) {
            router.push("/onboarding")
            return
          }

          if (profileError) {
            router.push("/onboarding")
            return
          }
        }

        const membership = getMembershipStatusFromMetadata(data.user.user_metadata)
        router.push(membership.isActive ? "/" : "/pricing")
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black">
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3.2}
          containerClassName="bg-black"
          colors={[
            [180, 200, 255],
            [120, 120, 255],
          ]}
          dotSize={5}
          reverse
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(4,7,29,0.95)_0%,_rgba(0,0,0,0.4)_55%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <MiniNavbar />

        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex flex-1 items-center justify-center">
            <div className="mt-[150px] w-full max-w-sm">
              <motion.div
                initial={{ opacity: 0, x: -80 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                    Welcome back
                  </h1>
                  <p className="text-[1.6rem] text-white/70 font-light">
                    Sign in to continue
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isBusy}
                    className="w-full rounded-full border border-white/15 bg-zinc-900/80 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center justify-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-xs font-semibold text-white/80">
                        G
                      </span>
                      {oauthLoading ? "Connecting..." : "Continue with Google"}
                    </span>
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-sm text-white/40">
                      Or use email
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-full border border-white/10 bg-zinc-900/80 py-3 px-4 text-center text-white placeholder:text-white/40 backdrop-blur-sm transition-colors focus:outline-none focus:border-white/30"
                    required
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-full border border-white/10 bg-zinc-900/80 py-3 px-4 text-center text-white placeholder:text-white/40 backdrop-blur-sm transition-colors focus:outline-none focus:border-white/30"
                    required
                  />

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 font-medium text-white transition-all hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <div className="pt-4 text-sm text-white/60">
                  Need an account?{" "}
                  <Link
                    href="/auth/signup"
                    className="font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    Create one
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
