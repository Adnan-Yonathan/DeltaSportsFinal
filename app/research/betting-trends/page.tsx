import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BettingTrendsPage() {
  redirect('/market-projections')
}
