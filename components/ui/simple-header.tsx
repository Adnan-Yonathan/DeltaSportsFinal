"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { DropdownNavigation } from "@/components/ui/dorpdown-navigation"
import { DROPDOWN_NAV_ITEMS } from "@/components/dropdown-nav-items"
import { createClient } from "@/lib/supabase/client"

export function SimpleHeader({
  rightSlot,
  mobileLeftSlot,
  onLogoClick,
  widthClass = "max-w-5xl",
}: {
  rightSlot?: React.ReactNode
  mobileLeftSlot?: React.ReactNode
  onLogoClick?: () => void
  widthClass?: string
} = {}) {
  const [showAuthButtons, setShowAuthButtons] = React.useState(false)
  const supabase = React.useMemo(() => createClient(), [])
  const router = useRouter()

  const navItems = React.useMemo(() => DROPDOWN_NAV_ITEMS, [])

  React.useEffect(() => {
    let isMounted = true

    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (isMounted) {
        setShowAuthButtons(!user)
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setShowAuthButtons(!session?.user)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleLogoClick = () => {
    onLogoClick ? onLogoClick() : router.push("/")
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-black/95 backdrop-blur border-b border-white/10">
      <div className={`mx-auto flex w-full ${widthClass} items-center gap-2 sm:gap-3`}>
        <nav className="flex h-12 sm:h-16 min-w-0 flex-1 items-center justify-between rounded-full border border-white/15 bg-black px-2 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-black/90 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 text-white"
              onClick={handleLogoClick}
            >
              <div className="relative h-6 w-6 sm:h-8 sm:w-8">
                  <Image
                    src="/delta-logo.png"
                    alt="Delta Sports Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              <div className="hidden items-center gap-1 sm:flex sm:gap-2">
                <p className="text-sm sm:text-lg font-semibold">Delta Sports</p>
              </div>
            </button>
            {mobileLeftSlot && (
              <div className="sm:hidden">
                {mobileLeftSlot}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div>
              <DropdownNavigation navItems={navItems} />
            </div>
            {rightSlot}
          </div>
        </nav>
        {showAuthButtons && (
          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
              <Link href="/auth/login">Log In</Link>
            </Button>
            <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
