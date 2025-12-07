"use client"

import { ArrowDownToDot, Sigma, Zap } from "lucide-react"
import { PricingSection, type PricingTier } from "@/components/ui/pricing-section"

const defaultTiers: PricingTier[] = [
  {
    name: "Pro",
    price: {
      monthly: 29,
      yearly: 15, // annual price per month (50% off)
    },
    description: "Full bankroll tracking plus live scores and odds you can trust.",
    highlight: true,
    badge: "Most Popular",
    icon: (
      <div className="relative">
        <ArrowDownToDot className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Bankroll Tracking",
        description: "Manage every bankroll across sports without limits.",
        included: true,
      },
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
      yearly: 99, // annual price per month (50% off)
    },
    description: "Unlimited chat, custom model builder, and premium support.",
    icon: (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300/40 to-cyan-200/40 blur-2xl" />
        <Sigma className="relative z-10 h-7 w-7 text-white" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Messages",
        description: "Brainstorm without limits—ask Delta AI anything, anytime.",
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

