"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"

interface StepPricingProps {
  value: string | null
  onChange: (value: string | null) => void
  onValidation: (isValid: boolean) => void
}

const PLANS = [
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 25,
    yearlyPrice: 15,
    description: "Perfect for serious bettors",
    features: [
      "100 AI messages per week",
      "Live odds from 10+ books",
      "Advanced statistics",
      "Live score tracking",
      "Smart line shopping",
    ],
    highlighted: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    monthlyPrice: 149,
    yearlyPrice: 99,
    description: "For professional bettors",
    features: [
      "Unlimited AI messages",
      "Custom model builder",
      "Advanced research tools",
      "Priority support",
      "All Pro features",
    ],
    highlighted: false,
  },
]

export function StepPricing({ value, onChange, onValidation }: StepPricingProps) {
  const [isYearly, setIsYearly] = useState(true)

  useEffect(() => {
    // Pricing is optional, always valid
    onValidation(true)
  }, [onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">Choose Your Plan</h2>
        <p className="text-white/60">Start your free trial or skip for now</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center p-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 backdrop-blur">
            {["Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Yearly")}
                className={`
                  px-6 py-2 text-sm font-medium rounded-full transition-all duration-300
                  ${(period === "Yearly") === isYearly
                    ? "bg-white text-black shadow-lg"
                    : "text-white/70 hover:text-white"
                  }
                `}
              >
                {period}
                {period === "Yearly" && (
                  <span className="ml-2 text-xs text-emerald-600 font-semibold">Save 40%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((plan) => {
            const isSelected = value === plan.id
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
            const priceLabel = "/month"

            return (
              <motion.div
                key={plan.id}
                className={`
                  relative rounded-2xl border-2 p-6 transition-all
                  ${isSelected
                    ? "bg-gradient-to-br from-emerald-500/20 via-emerald-500/15 to-cyan-500/10 border-emerald-400/70 ring-4 ring-emerald-400/20 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                    : plan.highlighted
                    ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-cyan-500/10 border-emerald-400/50"
                    : "bg-slate-900/70 border-emerald-400/15 hover:border-emerald-300/30"
                  }
                `}
                whileHover={{ scale: 1.02 }}
              >
                {plan.highlighted && !isSelected && (
                  <div className="absolute -top-4 left-6">
                    <div className="px-4 py-1 text-xs font-semibold uppercase tracking-wide bg-white text-black rounded-full shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">${price}</span>
                    <span className="text-white/60">{priceLabel}</span>
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
                  onClick={() => onChange(isSelected ? null : plan.id)}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                    ${isSelected
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : plan.highlighted
                      ? "bg-white text-black hover:bg-gray-100"
                      : "bg-white/10 text-white hover:bg-white/20"
                    }
                  `}
                >
                  {isSelected ? "Selected" : "Select Plan"}
                  {!isSelected && <ArrowRight className="w-4 h-4" />}
                </button>
              </motion.div>
            )
          })}
        </div>

        <div className="text-center mt-6">
          <p className="text-white/40 text-sm">
            You can skip this step and explore for free, or choose a plan to unlock all features
          </p>
        </div>
      </div>
    </motion.div>
  )
}
