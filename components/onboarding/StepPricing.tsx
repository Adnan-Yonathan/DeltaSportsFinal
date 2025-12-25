"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"

interface StepPricingProps {
  value: string | null
  onChange: (value: string | null) => void
  onValidation: (isValid: boolean) => void
}

const STRIPE_LINKS = {
  proTrial: "https://buy.stripe.com/fZu7sE6OY4Ct2Nr3Vyawo00",
  proMonthly: "https://buy.stripe.com/bJe6oAa1aglbds53Vyawo03",
  proAnnual: "https://buy.stripe.com/28E5kw8X6fh74VzgIkawo04",
  unlimitedMonthly: "https://buy.stripe.com/14A7sE1uE6KBfAd4ZCawo01",
  unlimitedAnnual: "https://buy.stripe.com/aFa3coc9i8SJ0Fj3Vyawo02",
}

const PLANS = [
  {
    id: "pro_trial",
    name: "Pro Trial",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Free 7-day trial. No card required.",
    features: [
      "25 messages per day",
      "Live score tracking",
      "Live odds tracking",
    ],
    highlighted: false,
    badge: "Trial",
    checkoutMonthly: STRIPE_LINKS.proTrial,
    checkoutYearly: STRIPE_LINKS.proTrial,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 9,
    description: "Full access to all core features.",
    features: [
      "25 messages per day",
      "Live score tracking",
      "Live odds tracking",
    ],
    highlighted: true,
    badge: "Most Popular",
    checkoutMonthly: STRIPE_LINKS.proMonthly,
    checkoutYearly: STRIPE_LINKS.proAnnual,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    monthlyPrice: 199,
    yearlyPrice: 83,
    description: "Unlimited chat and premium features.",
    features: [
      "Unlimited messages",
      "Custom model builder",
      "VIP support",
      "All Pro features",
    ],
    highlighted: false,
    checkoutMonthly: STRIPE_LINKS.unlimitedMonthly,
    checkoutYearly: STRIPE_LINKS.unlimitedAnnual,
  },
]

export function StepPricing({ value, onChange, onValidation }: StepPricingProps) {
  const [isYearly, setIsYearly] = useState(true)

  useEffect(() => {
    // Require a plan selection to proceed
    onValidation(value !== null)
  }, [value, onValidation])

  const handleSelectPlan = (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId)
    if (!plan) return

    // Set the selected plan
    onChange(planId)

    // Open checkout in new tab
    const checkoutUrl = isYearly ? plan.checkoutYearly : plan.checkoutMonthly
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">Choose Your Plan</h2>
        <p className="text-white/60">Select a plan to get started</p>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center p-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/10 backdrop-blur">
            {["Monthly", "Annual"].map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Annual")}
                className={`
                  px-6 py-2 text-sm font-medium rounded-full transition-all duration-300
                  ${(period === "Annual") === isYearly
                    ? "bg-white text-black shadow-lg"
                    : "text-white/70 hover:text-white"
                  }
                `}
              >
                {period}
                {period === "Annual" && (
                  <span className="ml-2 text-xs text-emerald-600 font-semibold">Save 70%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isSelected = value === plan.id
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
            const priceLabel = plan.id === "pro_trial" ? "" : isYearly ? "/mo (billed annually)" : "/month"

            return (
              <motion.div
                key={plan.id}
                className={`
                  relative rounded-2xl border-2 p-6 transition-all flex flex-col
                  ${isSelected
                    ? "bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-emerald-500/5 border-emerald-400/70 ring-4 ring-emerald-400/20 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                    : plan.highlighted
                    ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-500/5 border-emerald-400/50"
                    : "bg-slate-900/70 border-emerald-400/15 hover:border-emerald-300/30"
                  }
                `}
                whileHover={{ scale: 1.02 }}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-6">
                    <div className={`px-4 py-1 text-xs font-semibold uppercase tracking-wide rounded-full shadow-lg ${
                      plan.highlighted ? "bg-white text-black" : "bg-emerald-500 text-white"
                    }`}>
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div className="mb-6 flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {priceLabel && <span className="text-white/60">{priceLabel}</span>}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span className="text-white/80 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mt-auto
                    ${isSelected
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : plan.highlighted
                      ? "bg-white text-black hover:bg-gray-100"
                      : "bg-white/10 text-white hover:bg-white/20"
                    }
                  `}
                >
                  {isSelected ? "Selected" : plan.id === "pro_trial" ? "Start Free Trial" : "Select Plan"}
                  {!isSelected && <ArrowRight className="w-4 h-4" />}
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
