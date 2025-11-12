"use client"

import React from "react"
import Link from "next/link"
import { Grid2x2PlusIcon } from "lucide-react"
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { MenuToggle } from "@/components/ui/menu-toggle"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Uses", href: "#use-cases" },
  { label: "Pricing", href: "/pricing" },
]

export function SimpleHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-4 z-50 w-full">
      <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow">
              <Grid2x2PlusIcon className="h-5 w-5" />
            </div>
            <p className="font-jakarta text-lg font-semibold">Delta AI</p>
          </Link>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={buttonVariants({ variant: "ghost" })}
            >
              {link.label}
            </Link>
          ))}
          <Button asChild variant="outline">
            <Link href="/auth/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <Button size="icon" variant="outline" className="lg:hidden" onClick={() => setOpen(!open)}>
            <MenuToggle
              strokeWidth={2.5}
              open={open}
              onOpenChange={setOpen}
              className="h-6 w-6"
            />
          </Button>
          <SheetContent
            className="bg-background/95 supports-[backdrop-filter]:bg-background/80 gap-0 backdrop-blur"
            showClose={false}
            side="left"
          >
            <div className="grid gap-y-2 overflow-y-auto px-4 pt-12 pb-5">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={buttonVariants({
                    variant: "ghost",
                    className: "justify-start",
                  })}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <SheetFooter>
              <Button asChild variant="outline">
                <Link href="/auth/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
