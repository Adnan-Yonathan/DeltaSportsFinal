"use client"

import Link from "next/link"
import { Twitter } from "lucide-react"

const productLinks = [
  { href: "/welcome", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
]

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/affiliate", label: "Affiliate" },
  { href: "/auth/login", label: "Sign in" },
  { href: "/auth/signup", label: "Start free trial" },
]

const resourceLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/patch-notes", label: "Patch notes" },
  { href: "/tools/sharp-props", label: "Sharp Props" },
  { href: "/tools/whale-feed", label: "Whale Feed" },
]

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
  { href: "/refund-policy", label: "Refunds" },
]

export function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-lg font-semibold text-white">Delta Sports</p>
            <p className="mt-3 max-w-sm text-sm text-white/65">
              Proprietary tools for tracking sharp betting activity, market edges, and line movement
              in real time.
            </p>
            <Link
              href="/auth/signup"
              className="mt-5 inline-flex items-center rounded-full bg-[#3CCB97] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#52d8a8]"
            >
              Start free trial
            </Link>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <p>(c) {new Date().getFullYear()} Delta Sports. All rights reserved.</p>
            <Link
              href="https://x.com/DeltaSportsAI"
              target="_blank"
              rel="noreferrer"
              aria-label="Delta Sports on X"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:border-emerald-400/60 hover:text-emerald-200"
            >
              <Twitter className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ href: string; label: string }>
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-white/65 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

