"use client"

import { useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { cn } from "@/lib/utils"

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
}

interface PricingSectionProps {
  tiers: PricingTier[]
  className?: string
}

const buttonStyles = {
  default: cn(
    "h-12 bg-white text-black",
    "hover:bg-zinc-100",
    "border border-white/30",
    "shadow-sm hover:shadow-lg",
    "text-sm font-semibold",
  ),
  highlight: cn(
    "h-12 bg-gradient-to-r from-amber-300 via-amber-200 to-white text-black",
    "shadow-[0_8px_25px_rgba(0,0,0,0.35)]",
    "hover:from-amber-200 hover:via-white hover:to-white",
    "font-semibold text-base",
  ),
}

const badgeStyles = cn(
  "px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
  "bg-white text-black",
  "rounded-full shadow-lg",
)

export function PricingSection({ tiers, className }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(true)

  return (
    <section
      className={cn(
        "relative bg-black text-white",
        "py-16 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">
            Pricing
          </p>
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Simple, transparent pricing
          </h2>
          <div className="inline-flex items-center p-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur">
            {(["Monthly", "Annual"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Annual")}
                className={cn(
                  "px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300",
                  (period === "Annual") === isYearly
                    ? "bg-white text-black shadow-lg"
                    : "text-white/70 hover:text-white",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative backdrop-blur-sm",
                "rounded-3xl border",
                "flex flex-col",
                tier.highlight
                  ? "bg-white/10 border-white/30 shadow-2xl"
                  : "bg-white/5 border-white/10 shadow-lg",
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
                  <div className="p-3 rounded-2xl bg-white/10 text-white">
                    {tier.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{tier.name}</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      ${isYearly ? tier.price.yearly : tier.price.monthly}
                    </span>
                    <span className="text-sm text-white/60">
                      /month{isYearly ? " (billed annually)" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/70">{tier.description}</p>
                </div>

                <div className="space-y-4">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex gap-4">
                      <div
                        className={cn(
                          "mt-1 rounded-full border p-1",
                          feature.included
                            ? "text-emerald-300 border-emerald-300/50"
                            : "text-white/30 border-white/10",
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
                <Button
                  className={cn(
                    "w-full transition-all duration-300",
                    tier.highlight ? buttonStyles.highlight : buttonStyles.default,
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    {tier.highlight ? "Buy now" : "Get started"}
                    <ArrowRightIcon className="w-4 h-4" />
                  </span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
