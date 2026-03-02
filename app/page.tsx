import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { LAST_TOOL_COOKIE, sanitizeToolRoute } from '@/lib/navigation/tool-routes'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const cookieStore = cookies()
    const rawLastTool = cookieStore.get(LAST_TOOL_COOKIE)?.value
    let decodedLastTool: string | null = null
    if (rawLastTool) {
      try {
        decodedLastTool = decodeURIComponent(rawLastTool)
      } catch {
        decodedLastTool = rawLastTool
      }
    }
    redirect(sanitizeToolRoute(decodedLastTool))
  }

  redirect('/welcome')
}
