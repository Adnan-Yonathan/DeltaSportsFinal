"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

export type DropdownNavigationItem = {
  id: number
  label: string
  link?: {
    href: string
    external?: boolean
  }
  subMenus?: {
    title: string
    items: {
      label: string
      description: string
      icon: React.ElementType
      href: string
      external?: boolean
    }[]
  }[]
}

type Props = {
  navItems: DropdownNavigationItem[]
  className?: string
}

export function DropdownNavigation({ navItems, className }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const [activeId, setActiveId] = React.useState<number | null>(null)
  const [isHover, setIsHover] = useState<number | null>(null)
  const containerRef = useRef<HTMLUListElement | null>(null)

  const prefetchableHrefs = useMemo(() => {
    const out = new Set<string>()
    navItems.forEach((navItem) => {
      if (navItem.link?.href?.startsWith("/")) out.add(navItem.link.href)
      navItem.subMenus?.forEach((sub) => {
        sub.items.forEach((item) => {
          if (item.href?.startsWith("/")) out.add(item.href)
        })
      })
    })
    return Array.from(out)
  }, [navItems])

  useEffect(() => {
    setOpenMenu(null)
  }, [pathname])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setOpenMenu(null)
    }
    document.addEventListener("mousedown", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
    }
  }, [])

  const handleHover = (menuLabel: string | null) => {
    setOpenMenu(menuLabel)
  }

  const handlePrefetch = (href: string) => {
    if (!href.startsWith("/")) return
    router.prefetch(href)
  }

  useEffect(() => {
    // Warm up the most common internal routes to make clicks feel instant.
    prefetchableHrefs.slice(0, 8).forEach((href) => handlePrefetch(href))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ul
      ref={containerRef}
      className={className ?? "relative flex items-center space-x-0 rounded-full border border-white/10 bg-black px-1"}
    >
      {navItems.map((navItem) => {
        const isOpen = openMenu === navItem.label
        const isActive = navItem.link?.href ? pathname === navItem.link.href : false

        return (
          <li
            key={navItem.label}
            className="relative"
            onMouseEnter={() => handleHover(navItem.label)}
            onMouseLeave={() => handleHover(null)}
          >
            {navItem.subMenus ? (
              <button
                type="button"
                className="text-sm py-1.5 px-4 flex cursor-pointer group transition-colors duration-300 items-center justify-center gap-1 text-white/70 hover:text-white relative"
                aria-expanded={isOpen}
                onMouseEnter={() => {
                  setIsHover(navItem.id)
                  setActiveId(navItem.id)
                }}
                onMouseLeave={() => setIsHover(null)}
                onClick={() => setOpenMenu((prev) => (prev === navItem.label ? null : navItem.label))}
              >
                <span className="relative z-10">{navItem.label}</span>
                <ChevronDown
                  className={`relative z-10 h-4 w-4 group-hover:rotate-180 duration-300 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
                {(isHover === navItem.id || isOpen || activeId === navItem.id) && (
                  <motion.div
                    layoutId="hover-bg"
                    className="pointer-events-none absolute inset-0 size-full border border-white/10 bg-black"
                    style={{ borderRadius: 99 }}
                  />
                )}
              </button>
            ) : navItem.link ? (
              navItem.link.external ? (
                <a
                  href={navItem.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm py-1.5 px-4 flex cursor-pointer group transition-colors duration-300 items-center justify-center gap-1 text-white/70 hover:text-white relative"
                >
                  <span className="relative z-10">{navItem.label}</span>
                  {(isHover === navItem.id || isActive) && (
                    <motion.div
                      layoutId="hover-bg"
                      className="pointer-events-none absolute inset-0 size-full border border-white/10 bg-black"
                      style={{ borderRadius: 99 }}
                    />
                  )}
                </a>
              ) : (
                <Link
                  href={navItem.link.href}
                  onPointerEnter={() => handlePrefetch(navItem.link!.href)}
                  onMouseEnter={() => setActiveId(navItem.id)}
                  className="text-sm py-1.5 px-4 flex cursor-pointer group transition-colors duration-300 items-center justify-center gap-1 text-white/70 hover:text-white relative"
                >
                  <span className="relative z-10">{navItem.label}</span>
                  {(isHover === navItem.id || isActive || activeId === navItem.id) && (
                    <motion.div
                      layoutId="hover-bg"
                      className="pointer-events-none absolute inset-0 size-full border border-white/10 bg-black"
                      style={{ borderRadius: 99 }}
                    />
                  )}
                </Link>
              )
            ) : null}

            <AnimatePresence>
              {isOpen && navItem.subMenus && (
                <div className="w-auto absolute left-0 top-full pt-2 z-50">
                  <motion.div
                    className="bg-black border border-white/10 p-4 w-max shadow-2xl"
                    style={{ borderRadius: 16 }}
                    layoutId="menu"
                  >
                    <div className="w-fit shrink-0 flex space-x-9 overflow-hidden">
                      {navItem.subMenus.map((sub) => (
                        <motion.div layout className="w-full" key={sub.title}>
                          <h3 className="mb-4 text-sm font-medium capitalize text-muted-foreground">
                            {sub.title}
                          </h3>
                          <ul className="space-y-6">
                            {sub.items.map((item) => {
                              const Icon = item.icon

                              const content = (
                                <>
                                  <div className="border border-border text-foreground rounded-md flex items-center justify-center size-9 shrink-0 group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                                    <Icon className="h-5 w-5 flex-none" />
                                  </div>
                                  <div className="leading-5 w-max">
                                    <p className="text-sm font-medium text-foreground shrink-0">
                                      {item.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground shrink-0 group-hover:text-foreground transition-colors duration-300">
                                      {item.description}
                                    </p>
                                  </div>
                                </>
                              )

                              return (
                                <li key={item.label}>
                                  {item.external ? (
                                    <a
                                      href={item.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-start space-x-3 group"
                                    >
                                      {content}
                                    </a>
                                  ) : (
                                    <Link
                                      href={item.href}
                                      onClick={() => setOpenMenu(null)}
                                      onPointerEnter={() => handlePrefetch(item.href)}
                                      className="flex items-start space-x-3 group"
                                    >
                                      {content}
                                    </Link>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}
