"use client"

import { ArrowDownToDot, Sigma } from "lucide-react"
import { PricingSection, type PricingTier } from "@/components/ui/pricing-section"

const defaultTiers: PricingTier[] = [
  {
    name: "Pro Trial",
    price: {
      monthly: 0,
      yearly: 0,
    },
    description: "Free 7-day trial. Cancel anytime.",
    badge: "Trial",
    planKey: "pro_trial",
    icon: (
      <div className="relative">
        <ArrowDownToDot className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "25 Messages / Day",
        description: "Daily prompts to test ideas and get coaching.",
        included: true,
      },
      {
        name: "Live Score Tracking",
        description: "Real-time scoreboard overlays for every bet in play.",
        included: true,
      },
      {
        name: "Live Odds Tracking",
        description: "Monitor market moves as they happen across books.",
        included: true,
      },
    ],
  },
  {
    name: "Pro",
    price: {
      monthly: 29,
      yearly: 9, // annual price per month
    },
    description: "Real-time market monitoring plus live scores and odds you can trust.",
    highlight: true,
    badge: "Most Popular",
    planKeyMonthly: "pro_monthly",
    planKeyYearly: "pro_annual",
    icon: (
      <div className="relative">
        <ArrowDownToDot className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "25 Messages / Day",
        description: "Plenty of daily prompts to test ideas and get coaching.",
        included: true,
      },
      {
        name: "Live Score Tracking",
        description: "Real-time scoreboard overlays for every bet in play.",
        included: true,
      },
      {
        name: "Live Odds Tracking",
        description: "Monitor market moves as they happen across books.",
        included: true,
      },
    ],
  },
  {
    name: "Unlimited",
    price: {
      monthly: 199,
      yearly: 83, // annual price per month
    },
    description: "Unlimited chat, custom model builder, and premium support.",
    planKeyMonthly: "unlimited_monthly",
    planKeyYearly: "unlimited_annual",
    icon: (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300/40 to-emerald-200/25 blur-2xl" />
        <Sigma className="relative z-10 h-7 w-7 text-white" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Messages",
        description: "Brainstorm without limits - ask Delta Sports AI anything, anytime.",
        included: true,
      },
      {
        name: "Statistical Model Builder",
        description: "Create and deploy custom edges with no-code tooling.",
        included: true,
      },
      {
        name: "Live Scores + Odds",
        description: "All Pro monitoring perks baked in.",
        included: true,
      },
      {
        name: "VIP Support",
        description: "Direct access to analysts for rapid answers.",
        included: true,
      },
    ],
  },
]

export function PricingSectionDemo() {
  return <PricingSection tiers={defaultTiers} />
}
