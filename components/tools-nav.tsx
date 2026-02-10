"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { DROPDOWN_NAV_ITEMS } from "@/components/dropdown-nav-items"
import { DropdownNavigation } from "@/components/ui/dorpdown-navigation"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus } from "@/lib/utils/membership"

type ToolsNavProps = {
  hideMobileTop?: boolean
  showMobileChatBack?: boolean
}

export default function ToolsNav({
  hideMobileTop = true,
  showMobileChatBack = true,
}: ToolsNavProps) {
  const pathname = usePathname()
  const [homeHref, setHomeHref] = useState("/welcome")

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setHomeHref("/welcome")
        return
      }
      const membership = getMembershipStatus(user.user_metadata)
      setHomeHref(membership.hasPaidAccess ? "/chat" : "/welcome")
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <nav className="flex items-center gap-2">
        <Link
          href={homeHref}
          className={`${
            showMobileChatBack ? "inline-flex" : "hidden"
          } items-center rounded-full border border-white/10 bg-black/85 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-emerald-500/40 hover:bg-black hover:text-emerald-200`}
        >
          Home
        </Link>
        {!hideMobileTop ? (
          <div className="md:hidden">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              {pathname?.startsWith("/research") ? "Research" : "Tools"}
            </span>
          </div>
        ) : null}
        <DropdownNavigation navItems={DROPDOWN_NAV_ITEMS} />
      </nav>
    </>
  )
}
