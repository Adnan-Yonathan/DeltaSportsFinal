import AffiliateClient from "./affiliate-client"

export const dynamic = "force-dynamic"

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <AffiliateClient />
    </div>
  )
}
