import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default async function AdminAffiliatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/admin/affiliates")
  }

  const isDev = process.env.NODE_ENV !== "production"
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  if (!isDev && !adminEmails.includes(user.email?.toLowerCase() || "")) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6 text-sm text-white/70">
          Access denied.
        </div>
      </div>
    )
  }

  const service = createServiceClient()
  const { data: affiliates } = await service
    .from("affiliates" as any)
    .select("user_id, code, status, created_at")
    .order("created_at", { ascending: false })

  const { data: clicks } = await service
    .from("affiliate_clicks" as any)
    .select("code")

  const { data: attributions } = await service
    .from("affiliate_attributions" as any)
    .select("code, status, amount_cents, converted_at, created_at, paid_at")

  const { data: creatorInquiries } = await service
    .from("creator_inquiries" as any)
    .select("name, creator_type, social_accounts, followers_estimate, views_per_month, expected_pay, phone, created_at")
    .order("created_at", { ascending: false })

  const affiliateRows = (affiliates ?? []) as Array<{
    user_id: string
    code: string
    status: string
    created_at: string
  }>
  const clickRows = (clicks ?? []) as Array<{ code: string }>
  const attributionRows = (attributions ?? []) as Array<{
    code: string
    status: string
    amount_cents: number | null
    converted_at: string | null
    created_at: string
    paid_at: string | null
  }>
  const inquiryRows = (creatorInquiries ?? []) as Array<{
    name: string
    creator_type: string
    social_accounts: string
    followers_estimate: number | null
    views_per_month: number | null
    expected_pay: string | null
    phone: string | null
    created_at: string
  }>

  const clickMap = new Map<string, number>()
  for (const row of clickRows) {
    clickMap.set(row.code, (clickMap.get(row.code) || 0) + 1)
  }

  const earningsMap = new Map<string, { earned: number; pending: number; count: number }>()
  for (const row of attributionRows) {
    const entry = earningsMap.get(row.code) || { earned: 0, pending: 0, count: 0 }
    if (row.status === "earned" || row.status === "paid") {
      entry.earned += row.amount_cents || 0
      entry.count += 1
    } else if (row.status === "pending") {
      entry.pending += row.amount_cents || 0
    }
    earningsMap.set(row.code, entry)
  }

  const summary = {
    affiliates: affiliateRows.length,
    clicks: clickRows.length,
    conversions: attributionRows.filter((row) => row.status === "earned" || row.status === "paid").length,
    earned: attributionRows
      .filter((row) => row.status === "earned" || row.status === "paid")
      .reduce((sum, row) => sum + (row.amount_cents || 0), 0),
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Affiliate dashboard</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Affiliates</p>
            <p className="mt-2 text-2xl font-semibold">{summary.affiliates}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Clicks</p>
            <p className="mt-2 text-2xl font-semibold">{summary.clicks}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Conversions</p>
            <p className="mt-2 text-2xl font-semibold">{summary.conversions}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Earned</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(summary.earned)}</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Affiliates</h2>
            <span className="text-xs text-white/50">{affiliateRows.length} total</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-white/70">
              <thead className="uppercase tracking-[0.2em] text-white/40">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Clicks</th>
                  <th className="px-3 py-2">Conversions</th>
                  <th className="px-3 py-2">Earned</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {affiliateRows.map((affiliate) => {
                  const earnings = earningsMap.get(affiliate.code) || {
                    earned: 0,
                    pending: 0,
                    count: 0,
                  }
                  return (
                    <tr key={affiliate.code} className="border-b border-white/5">
                      <td className="px-3 py-3 font-semibold text-white">{affiliate.code}</td>
                      <td className="px-3 py-3 text-white/50">{affiliate.user_id}</td>
                      <td className="px-3 py-3">{clickMap.get(affiliate.code) || 0}</td>
                      <td className="px-3 py-3">{earnings.count}</td>
                      <td className="px-3 py-3">{formatMoney(earnings.earned)}</td>
                      <td className="px-3 py-3">{formatMoney(earnings.pending)}</td>
                      <td className="px-3 py-3 uppercase tracking-[0.2em] text-emerald-300/80">
                        {affiliate.status}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Creator inquiries</h2>
            <span className="text-xs text-white/50">{inquiryRows.length} total</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-white/70">
              <thead className="uppercase tracking-[0.2em] text-white/40">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Social</th>
                  <th className="px-3 py-2">Followers</th>
                  <th className="px-3 py-2">Views/mo</th>
                  <th className="px-3 py-2">Expected Pay</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {inquiryRows.map((entry, index) => (
                  <tr key={`${entry.name}-${entry.created_at}-${index}`} className="border-b border-white/5">
                    <td className="px-3 py-3 font-semibold text-white">{entry.name}</td>
                    <td className="px-3 py-3 uppercase tracking-[0.2em] text-emerald-300/80">
                      {entry.creator_type}
                    </td>
                    <td className="px-3 py-3 text-white/60">{entry.social_accounts}</td>
                    <td className="px-3 py-3">{entry.followers_estimate ?? "-"}</td>
                    <td className="px-3 py-3">{entry.views_per_month ?? "-"}</td>
                    <td className="px-3 py-3">{entry.expected_pay ?? "-"}</td>
                    <td className="px-3 py-3">{entry.phone ?? "-"}</td>
                    <td className="px-3 py-3 text-white/40">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {inquiryRows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-white/40" colSpan={8}>
                      No creator inquiries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
