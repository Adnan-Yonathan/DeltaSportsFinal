import { redirect } from 'next/navigation'
import ManageSubscriptionPage from '@/components/billing/manage-subscription-page'
import { createClient } from '@/lib/supabase/server'
import { getBillingSnapshotForUser } from '@/lib/stripe-billing'

export const dynamic = 'force-dynamic'

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth is assumed to exist globally, but this page still protects itself.
  if (!user) {
    redirect('/auth/login?redirect=/billing')
  }

  const billing = await getBillingSnapshotForUser(user)
  const resolvedSearchParams = (await searchParams) ?? {}
  const paymentMethodUpdated = resolvedSearchParams.payment_method_updated === '1'

  return (
    <ManageSubscriptionPage
      billing={billing}
      paymentMethodUpdated={paymentMethodUpdated}
    />
  )
}
