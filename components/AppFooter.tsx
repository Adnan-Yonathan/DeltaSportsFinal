"use client"

import { useState } from "react"
import Link from "next/link"
import { Twitter } from "lucide-react"

export function AppFooter() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) return
    setStatus("loading")
    try {
      const res = await fetch("/api/email-optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      })
      if (!res.ok) throw new Error("Opt-in failed")
      setStatus("success")
      setEmail("")
    } catch {
      setStatus("error")
    }
  }

  return (
    <footer className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs sm:flex-row sm:gap-6">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-start"
        >
          <label className="sr-only" htmlFor="delta-email-optin">
            Email
          </label>
          <input
            id="delta-email-optin"
            type="email"
            required
            placeholder="Get one sharp bet per day"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-full border border-white/10 bg-black px-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400/60"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-300 hover:text-white disabled:opacity-50 sm:w-auto"
          >
            {status === "loading" ? "Joining..." : "Free Alerts"}
          </button>
        </form>
        <p className="text-[11px] tracking-wide">
          Delta Sports Beta (NBA) - AI-powered insights for serious bettors.
        </p>
        <p className="text-[11px] text-white/60">
          (c) {new Date().getFullYear()} Delta Sports. All rights reserved.
        </p>
        {status === "success" && (
          <p className="text-[11px] text-emerald-300">Check your inbox tomorrow.</p>
        )}
        {status === "error" && (
          <p className="text-[11px] text-rose-300">Could not subscribe.</p>
        )}
        <Link
          href="https://x.com/DeltaSportsAI"
          target="_blank"
          rel="noreferrer"
          aria-label="Delta Sports on X"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:border-emerald-400/60 hover:text-emerald-200"
        >
          <Twitter className="h-4 w-4" />
        </Link>
      </div>
    </footer>
  )
}

