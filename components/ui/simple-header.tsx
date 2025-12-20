"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Grid2x2PlusIcon } from "lucide-react"
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { MenuToggle } from "@/components/ui/menu-toggle"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Uses", href: "#use-cases" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
]

export function SimpleHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-4 z-50 w-full">
      <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between rounded-full border border-white/15 bg-black px-4 backdrop-blur supports-[backdrop-filter]:bg-black/90 text-white">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-white">
            <div className="relative h-8 w-8">
              <Image
                src="/Screenshot 2025-12-20 140455.png"
                alt="Delta Sports Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="font-jakarta text-lg font-semibold">Delta Sports</p>
          </Link>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-white/70 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
            <Link href="/auth/login">Log In</Link>
          </Button>
          <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <Button size="icon" variant="outline" className="lg:hidden bg-black text-white border border-white/20 hover:bg-white/10" onClick={() => setOpen(!open)}>
            <MenuToggle
              strokeWidth={2.5}
              open={open}
              onOpenChange={setOpen}
              className="h-6 w-6"
            />
          </Button>
          <SheetContent
            className="bg-black/95 supports-[backdrop-filter]:bg-black/90 gap-0 backdrop-blur text-white"
            showClose={false}
            side="left"
          >
            <div className="grid gap-y-2 overflow-y-auto px-4 pt-12 pb-5">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="justify-start text-white/80 hover:text-white px-3 py-2 rounded-md transition-colors"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <SheetFooter>
              <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
                <Link href="/auth/login">Log In</Link>
              </Button>
              <Button asChild className="bg-[#34d399] text-[#0f1f15] border border-[#34d399] hover:bg-[#16a34a]">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
