"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AffiliateStats = {
  hasAffiliate: boolean
  affiliate?: {
    code: string
    status: string
    createdAt: string
  }
  totals: {
    clicks: number
    pendingCount: number
    earnedCount: number
    pendingCents: number
    earnedCents: number
  }
  attributions: Array<{
    status: string
    amount_cents: number
    created_at: string
    trial_end_at?: string | null
    converted_at?: string | null
  }>
}

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function AffiliateClient() {
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "sent">("idle")
  const [formError, setFormError] = useState("")
  const [payoutStatus, setPayoutStatus] = useState<"idle" | "submitting" | "sent">("idle")
  const [payoutError, setPayoutError] = useState("")
  const [creatorType, setCreatorType] = useState<"ugc" | "creator">("ugc")
  const [creatorName, setCreatorName] = useState("")
  const [socialAccounts, setSocialAccounts] = useState("")
  const [followersEstimate, setFollowersEstimate] = useState("")
  const [viewsPerMonth, setViewsPerMonth] = useState("")
  const [expectedPay, setExpectedPay] = useState("")
  const [phone, setPhone] = useState("")

  const loadStats = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/affiliate/stats", { cache: "no-store" })
      const data = await res.json()
      if (res.status === 401) {
        setNeedsAuth(true)
        setStats(null)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to load stats")
      setStats(data)
      if (data?.affiliate?.code) {
        setCode(data.affiliate.code)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load affiliate data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStats()
  }, [])

  const handleGenerate = async () => {
    try {
      setBusy(true)
      setError("")
      const res = await fetch("/api/affiliate/link", { method: "POST" })
      const data = await res.json()
      if (res.status === 401) {
        setNeedsAuth(true)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to generate link")
      setLink(data.link)
      setCode(data.code)
      await loadStats()
    } catch (err: any) {
      setError(err.message || "Failed to generate link")
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // ignore
    }
  }

  const handleCreatorSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!creatorName || !socialAccounts) {
      setFormError("Name and social accounts are required.")
      return
    }
    setFormStatus("submitting")
    setFormError("")
    try {
      const res = await fetch("/api/affiliate/creator-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creatorName,
          creatorType,
          socialAccounts,
          followersEstimate,
          viewsPerMonth,
          expectedPay,
          phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit")
      setFormStatus("sent")
      setCreatorName("")
      setSocialAccounts("")
      setFollowersEstimate("")
      setViewsPerMonth("")
      setExpectedPay("")
      setPhone("")
      setCreatorType("ugc")
    } catch (err: any) {
      setFormError(err.message || "Failed to submit inquiry.")
      setFormStatus("idle")
    }
  }

  const totals = stats?.totals
  const earnedCents = totals?.earnedCents ?? 0

  const handlePayoutRequest = async () => {
    try {
      setPayoutStatus("submitting")
      setPayoutError("")
      const res = await fetch("/api/affiliate/payout-request", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to request payout")
      setPayoutStatus("sent")
      await loadStats()
    } catch (err: any) {
      setPayoutError(err.message || "Failed to request payout")
      setPayoutStatus("idle")
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
          Affiliate Program
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Earn for real conversions</h1>
        <div className="mt-4">
          <Button
            onClick={() => (window.location.href = "/")}
            className="h-10 bg-white/10 text-white hover:bg-white/20"
          >
            Back Home
          </Button>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-white/60">
          Anyone can generate a referral link. Payouts are earned only after a
          trial converts into a paid subscription. No payout for canceled
          trials.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-emerald-500/20 bg-black/60 p-6 shadow-xl">
          <h2 className="text-lg font-semibold">How it works</h2>
          <div className="mt-4 space-y-3 text-sm text-white/60">
            <div className="flex gap-3">
              <span className="text-emerald-300">1.</span>
              <span>Share your link anywhere you want.</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-300">2.</span>
              <span>We track trial signups and conversions.</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-300">3.</span>
              <span>Earn once the trial ends and the subscription is paid.</span>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100/90">
            Abuse safeguards are active: self-referrals, duplicate payment
            methods, and rapid churn are blocked.
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-black/60 p-6 shadow-xl">
          <h2 className="text-lg font-semibold">Your referral link</h2>
          <p className="mt-2 text-xs text-white/50">
            Create once, reuse anywhere.
          </p>
          <div className="mt-5 space-y-3">
            {needsAuth ? (
              <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-sm text-white/70">
                Sign in to generate your affiliate link.
              </div>
            ) : code ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-xs text-white/80">
                  {link || `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code}`}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    className={cn(
                      "flex-1 h-11 bg-emerald-400 text-black hover:bg-emerald-300"
                    )}
                  >
                    Copy link
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={busy}
                    className="h-11 flex-1 bg-white/10 text-white hover:bg-white/20"
                  >
                    Refresh
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={busy}
                className="h-11 w-full bg-emerald-400 text-black hover:bg-emerald-300"
              >
                {busy ? "Generating..." : "Generate link"}
              </Button>
            )}
            {error && !needsAuth && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-3xl border border-white/10 bg-black/70 p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Affiliate dashboard</h2>
          <p className="text-xs text-white/50">
            Updates after trials convert to paid.
          </p>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-white/60 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Commission
            </p>
            <p className="mt-2 text-sm text-white/80">
              25% on monthly memberships, 40% on annual memberships.
            </p>
            <p className="mt-1 text-xs text-white/50">
              Payouts run on a 30 day cycle for now and are paid at the start of
              the next month.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Creator opportunities
            </p>
            <p className="mt-2 text-sm text-white/80">
              We are looking for creators for paid promotions and UGC. Any
              referrals from creator partnerships get a referral bonus.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-6 text-sm text-white/50">Loading...</div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Clicks
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {totals?.clicks ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {totals?.pendingCount ?? 0}
                </p>
                <p className="text-xs text-white/50">
                  {formatMoney(totals?.pendingCents ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Earned
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {totals?.earnedCount ?? 0}
                </p>
                <p className="text-xs text-white/50">
                  {formatMoney(totals?.earnedCents ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Status
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-300">
                  {stats?.affiliate?.status ?? "Not active"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Button
                onClick={handlePayoutRequest}
                disabled={payoutStatus === "submitting" || earnedCents <= 0}
                className="h-10 bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-60"
              >
                {payoutStatus === "submitting"
                  ? "Requesting..."
                  : "Request payment"}
              </Button>
              <div className="text-xs text-white/50">
                {earnedCents > 0
                  ? `Earned balance: ${formatMoney(earnedCents)}`
                  : "No earned balance yet."}
              </div>
            </div>
            {payoutStatus === "sent" && (
              <p className="mt-2 text-xs text-emerald-200">
                Payout request received. We will process it on the next cycle.
              </p>
            )}
            {payoutError && (
              <p className="mt-2 text-xs text-red-300">{payoutError}</p>
            )}

            <div className="mt-8 border-t border-white/10 pt-6">
              {stats?.attributions?.length ? (
                <div className="space-y-3 text-xs text-white/60">
                  {stats.attributions.slice(0, 8).map((entry, index) => (
                    <div
                      key={`${entry.created_at}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/60 px-4 py-3"
                    >
                      <span className="uppercase tracking-[0.2em] text-white/40">
                        {entry.status}
                      </span>
                      <span>{formatMoney(entry.amount_cents || 0)}</span>
                      <span className="text-white/40">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50">
                  No conversions yet. Share your link to get started.
                </p>
              )}
            </div>
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-6">
              <h3 className="text-base font-semibold">Creator intake form</h3>
              <p className="mt-2 text-xs text-white/50">
                Tell us a bit about your audience and preferred work.
              </p>
              <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreatorSubmit}>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Creator type
                  </label>
                  <div className="mt-2 flex gap-2">
                    {(["ugc", "creator"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCreatorType(option)}
                        className={cn(
                          "rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors",
                          creatorType === option
                            ? "bg-emerald-400 text-black"
                            : "border border-white/10 bg-black/70 text-white/60 hover:text-white"
                        )}
                      >
                        {option === "ugc" ? "UGC" : "Creator"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Name
                  </label>
                  <input
                    required
                    value={creatorName}
                    onChange={(event) => setCreatorName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Phone
                  </label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="Phone number"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Social accounts
                  </label>
                  <input
                    required
                    value={socialAccounts}
                    onChange={(event) => setSocialAccounts(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="TikTok, IG, YouTube, X, etc."
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Followers (approx.)
                  </label>
                  <input
                    value={followersEstimate}
                    onChange={(event) => setFollowersEstimate(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="e.g. 50,000"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Views per month
                  </label>
                  <input
                    value={viewsPerMonth}
                    onChange={(event) => setViewsPerMonth(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="e.g. 250,000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Expected pay
                  </label>
                  <input
                    value={expectedPay}
                    onChange={(event) => setExpectedPay(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                    placeholder="Your rate or range"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={formStatus === "submitting"}
                    className="h-11 w-full bg-emerald-400 text-black hover:bg-emerald-300"
                  >
                    {formStatus === "submitting" ? "Submitting..." : "Submit"}
                  </Button>
                  {formStatus === "sent" && (
                    <p className="text-xs text-emerald-200">
                      Thanks! We will reach out shortly.
                    </p>
                  )}
                  {formError && (
                    <p className="text-xs text-red-300">{formError}</p>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
