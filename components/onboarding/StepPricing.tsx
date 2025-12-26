"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, ArrowRight, Loader2 } from "lucide-react"

interface StepPricingProps {
  value: string | null
  onChange: (value: string | null) => void
  onValidation: (isValid: boolean) => void
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
    planKey: "pro_trial",
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
    planKeyMonthly: "pro_monthly",
    planKeyYearly: "pro_annual",
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
    planKeyMonthly: "unlimited_monthly",
    planKeyYearly: "unlimited_annual",
  },
]

export function StepPricing({ value, onChange, onValidation }: StepPricingProps) {
  const [isYearly, setIsYearly] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  useEffect(() => {
    // Require a plan selection to proceed
    onValidation(value !== null)
  }, [value, onValidation])

  const handleSelectPlan = async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId)
    if (!plan) return

    // Set the selected plan
    onChange(planId)

    // Determine plan key
    const planKey = plan.planKey || (isYearly ? plan.planKeyYearly : plan.planKeyMonthly)
    if (!planKey) return

    setLoadingPlan(planId)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert(error instanceof Error ? error.message : 'Failed to start checkout')
    } finally {
      setLoadingPlan(null)
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
            const monthlyPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice
            const dailyPrice = monthlyPrice > 0 ? (monthlyPrice / 30).toFixed(2) : 0
            const isFree = monthlyPrice === 0
            const priceLabel = isFree ? "" : isYearly ? "/day (billed annually)" : "/day"
            const isLoading = loadingPlan === plan.id

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
                      {isFree ? "Free" : `$${dailyPrice}`}
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
                  disabled={isLoading}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mt-auto
                    ${isSelected
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : plan.highlighted
                      ? "bg-white text-black hover:bg-gray-100"
                      : "bg-white/10 text-white hover:bg-white/20"
                    }
                    ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isSelected ? (
                    "Selected"
                  ) : plan.id === "pro_trial" ? (
                    <>
                      Start Free Trial
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Select Plan
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
