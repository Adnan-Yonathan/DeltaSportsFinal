"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface Feature {
  name: string
  description: string
  included: boolean
}

export interface PricingTier {
  name: string
  price: {
    monthly: number
    yearly: number
  }
  description: string
  features: Feature[]
  highlight?: boolean
  badge?: string
  icon: ReactNode
  checkoutUrlMonthly?: string
  checkoutUrlYearly?: string
  planKeyMonthly?: string
  planKeyYearly?: string
}

interface PricingSectionProps {
  tiers: PricingTier[]
  className?: string
}

const buttonStyles = {
  default: cn(
    "h-12 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white",
    "hover:from-emerald-400 hover:to-emerald-300",
    "border border-emerald-300/40",
    "shadow-[0_8px_24px_rgba(16,185,129,0.24)]",
    "text-sm font-semibold"
  ),
  highlight: cn(
    "h-12 bg-white text-slate-900",
    "shadow-[0_10px_30px_rgba(16,185,129,0.28)]",
    "hover:bg-emerald-50",
    "font-semibold text-base"
  ),
}

const badgeStyles = cn(
  "px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
  "bg-emerald-400 text-slate-900",
  "rounded-full shadow-lg"
)

export function PricingSection({ tiers, className }: PricingSectionProps) {     
  const [isYearly, setIsYearly] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email ?? null)
      }
    }
    loadUser()
  }, [])

  const buildCheckoutUrl = (baseUrl?: string, planKey?: string) => {
    if (!baseUrl) return undefined
    const params = new URLSearchParams()
    if (userId && planKey) {
      params.set("client_reference_id", `${userId}:${planKey}`)
    }
    if (userEmail) {
      params.set("prefilled_email", userEmail)
    }
    const query = params.toString()
    if (!query) return baseUrl
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`
  }

  return (
    <section
      className={cn(
        "relative bg-gradient-to-b from-neutral-850 to-neutral-900 text-slate-50",
        "py-16 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Pricing</p>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Simple, transparent pricing</h2>
          <div className="inline-flex items-center p-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/10 backdrop-blur">
            {(["Monthly", "Annual"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Annual")}
                className={cn(
                  "px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300",
                  (period === "Annual") === isYearly
                    ? "bg-white text-slate-900 shadow-lg"
                    : "text-slate-200/70 hover:text-white",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative backdrop-blur-sm rounded-3xl border flex flex-col",
                tier.highlight
                  ? "bg-neutral-800/90 border-emerald-300/40 shadow-2xl"
                  : "bg-neutral-850/90 border-emerald-300/15 shadow-lg",
                "transition-transform duration-300 hover:-translate-y-1",
              )}
            >
              {tier.badge && tier.highlight && (
                <div className="absolute -top-4 left-6">
                  <Badge className={badgeStyles}>{tier.badge}</Badge>
                </div>
              )}

              <div className="p-8 flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-200">
                    {tier.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{tier.name}</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      ${isYearly ? tier.price.yearly : tier.price.monthly}
                    </span>
                    <span className="text-sm text-slate-200/70">
                      /month{isYearly ? " (billed annually)" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-200/70">{tier.description}</p>
                </div>

                <div className="space-y-4">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex gap-4">
                      <div
                        className={cn(
                          "mt-1 rounded-full border p-1",
                          feature.included
                            ? "text-emerald-300 border-emerald-300/50 bg-emerald-500/10"
                            : "text-slate-300/40 border-emerald-400/10",
                        )}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{feature.name}</div>
                        <div className="text-sm text-white/60">
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 pt-0 mt-auto">
                {(() => {
                  const checkoutUrl = buildCheckoutUrl(
                    isYearly ? tier.checkoutUrlYearly : tier.checkoutUrlMonthly,
                    isYearly ? tier.planKeyYearly : tier.planKeyMonthly
                  )
                  return (
                    <Button
                      asChild={Boolean(checkoutUrl)}
                      className={cn(
                        "w-full transition-all duration-300",
                        tier.highlight ? buttonStyles.highlight : buttonStyles.default,
                      )}
                    >
                      {checkoutUrl ? (
                        <a
                          href={checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="flex items-center justify-center gap-2">
                            {tier.highlight ? "Buy now" : "Get started"}
                            <ArrowRightIcon className="w-4 h-4" />
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {tier.highlight ? "Buy now" : "Get started"}
                          <ArrowRightIcon className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
