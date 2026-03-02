"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus } from "@/lib/utils/membership"

type HomeLinkProps = {
  className?: string
  label?: string
}

const resolveHomeHref = (user: { user_metadata?: Record<string, any> } | null) => {
  if (!user) return "/welcome"
  const membership = getMembershipStatus(user.user_metadata)
  return membership.hasPaidAccess ? "/" : "/welcome"
}

export default function HomeLink({ className, label = "Home" }: HomeLinkProps) {
  const [href, setHref] = useState("/welcome")

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      setHref(resolveHomeHref(user))
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  )
}
