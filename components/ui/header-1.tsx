'use client'

import React from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon'
import { useScroll } from '@/components/ui/use-scroll'

const ACCENT = '#3CCB97'

export function Header() {
  const [open, setOpen] = React.useState(false)
  const scrolled = useScroll(10)

  const links = [
    { label: 'Features', href: '#features', targetId: 'features' },
    { label: 'Pricing', href: '#pricing', targetId: 'pricing' },
  ]

  const handleSectionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    event.preventDefault()
    setOpen(false)

    // Wait one frame so mobile menu/body overflow state is released before scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(targetId)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', `#${targetId}`)
      })
    })
  }

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b border-transparent', {
        'bg-black/90 backdrop-blur-lg border-white/10': scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-white/90 hover:bg-white/5">
          <Image src="/delta-logo.png" alt="Delta Sports logo" width={18} height={18} className="rounded-sm" />
          <span className="text-sm font-semibold tracking-[0.18em]" style={{ color: '#ffffff' }}>DELTA SPORTS</span>
        </a>

        <div className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              className={buttonVariants({ variant: 'ghost' })}
              href={link.href}
              onClick={(event) => handleSectionClick(event, link.targetId)}
              style={{ color: '#ffffff' }}
            >
              {link.label}
            </a>
          ))}
          <Button asChild variant="outline" className="border-white/20 bg-transparent" style={{ color: '#ffffff', borderColor: ACCENT }}>
            <a href="/auth/login">Sign In</a>
          </Button>
          <Button asChild className="text-black" style={{ backgroundColor: ACCENT }}>
            <a href="/auth/signup">Get Started</a>
          </Button>
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen((prev) => !prev)}
          className="border-white/20 bg-transparent text-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>

      <MobileMenu open={open} className="flex flex-col justify-between gap-2">
        <div className="grid gap-y-2">
          {links.map((link) => (
            <a
              key={link.label}
              className={buttonVariants({
                variant: 'ghost',
                className: 'justify-start',
              })}
              href={link.href}
              onClick={(event) => handleSectionClick(event, link.targetId)}
              style={{ color: '#ffffff' }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full bg-transparent" style={{ color: '#ffffff', borderColor: ACCENT }}>
            <a href="/auth/login">Sign In</a>
          </Button>
          <Button asChild className="w-full text-black" style={{ backgroundColor: ACCENT }}>
            <a href="/auth/signup">Get Started</a>
          </Button>
        </div>
      </MobileMenu>
    </header>
  )
}

type MobileMenuProps = React.ComponentProps<'div'> & {
  open: boolean
}

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        'bg-black/95 backdrop-blur-lg fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y border-white/10 md:hidden'
      )}
    >
      <div
        data-slot={open ? 'open' : 'closed'}
        className={cn(
          'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out size-full p-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
