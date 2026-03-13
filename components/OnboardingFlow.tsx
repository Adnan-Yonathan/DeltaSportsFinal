'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ExternalLink, Instagram, MessageSquareText, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getBookmakerLink } from '@/lib/config/bookmaker-links'
import {
  TOOLS_TUTORIAL_LOCAL_KEY,
  TOOLS_TUTORIAL_METADATA_KEY,
} from '@/lib/tools-tutorial'

const SOCIAL_LINKS = [
  {
    label: 'X / Twitter',
    href: 'https://x.com/DeltaSportsAI',
    description: 'Release notes, sharp clips, and product updates.',
    icon: Sparkles,
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/SBB4QAQQ',
    description: 'Community chat, alerts, and direct feedback.',
    icon: MessageSquareText,
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/deltasportsai?igsh=dXcweHRiNGt5eXQ2',
    description: 'Visual breakdowns and behind-the-scenes updates.',
    icon: Instagram,
  },
] as const

const KALSHI_AFFILIATE_URL =
  getBookmakerLink('kalshi') ||
  'https://kalshi.com/sign-up/?referral=4807d3a2-7c7c-40bb-986c-608115b5a2c5'

export function OnboardingFlow() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [isContinuing, setIsContinuing] = useState(false)

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      if (!user) {
        router.replace('/auth/login')
        return
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOOLS_TUTORIAL_LOCAL_KEY, '1')
      }

      try {
        await supabase.auth.updateUser({
          data: {
            [TOOLS_TUTORIAL_METADATA_KEY]: true,
            onboarding_completed: true,
          },
        })
      } catch {
        // Best effort only. Do not block access to the product.
      }

      if (active) {
        setIsLoading(false)
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [router, supabase])

  const handleContinue = () => {
    setIsContinuing(true)
    router.push('/')
  }

  if (isLoading) {
    return <div className="min-h-screen bg-[#02070f]" />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02070f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.14),transparent_24%),linear-gradient(180deg,#02070f_0%,#03110d_55%,#02070f_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full rounded-[2rem] border border-white/10 bg-black/45 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur md:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="inline-flex items-center rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
                Welcome to Delta
              </div>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                Your trial is live. We are just getting started.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                Thanks for joining Delta. Follow us on socials for product updates, use our Kalshi
                affiliate link for a $25 bonus, and stay tuned as we roll out more improvements and
                new partnerships.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={isContinuing}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#04120c] transition hover:bg-emerald-300 disabled:opacity-60"
                >
                  <span>{isContinuing ? 'Opening Delta...' : 'Open Delta'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href={KALSHI_AFFILIATE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
                >
                  <span>Claim your Kalshi $25 bonus</span>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {SOCIAL_LINKS.map((link) => {
                  const Icon = link.icon

                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/30 hover:bg-emerald-400/8"
                    >
                      <div className="inline-flex rounded-2xl border border-white/10 bg-white/8 p-3 text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-lg font-semibold text-white">{link.label}</div>
                      <p className="mt-2 text-sm leading-6 text-white/65">{link.description}</p>
                    </Link>
                  )
                })}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">
                  Kalshi bonus
                </div>
                <div className="mt-3 text-3xl font-black text-white">$25 extra</div>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  Use the Delta Kalshi affiliate link when you sign up to unlock the current $25
                  bonus offer.
                </p>
                <Link
                  href={KALSHI_AFFILIATE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-black/25 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/50 hover:bg-black/35"
                >
                  Open Kalshi affiliate link
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">
                  What to expect
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/72">
                  <li>More product improvements are on the way.</li>
                  <li>We are working on new partnerships and bonus offers.</li>
                  <li>Social channels will be the fastest place to catch new drops.</li>
                </ul>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">
                  Stay plugged in
                </div>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  Follow Delta on X, Discord, and Instagram, then head into the app and start using
                  the tools during your trial.
                </p>
                <Link
                  href="/socials"
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:text-white"
                >
                  View all socials
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
