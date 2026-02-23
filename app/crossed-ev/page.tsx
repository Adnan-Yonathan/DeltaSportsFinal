import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function LegacySharpPropsRedirectPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams.sport[0]
    : searchParams?.sport
  const nextHref = requestedSport
    ? `/sharp-props?sport=${encodeURIComponent(requestedSport)}`
    : "/sharp-props"
  redirect(nextHref)
}
