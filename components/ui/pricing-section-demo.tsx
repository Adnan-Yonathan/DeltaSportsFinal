"use client"

import { ArrowDownToDot, Sigma, TrendingUp } from "lucide-react"
import { PricingSection, type PricingTier } from "@/components/ui/pricing-section"

const defaultTiers: PricingTier[] = [
  {
    name: "Pro",
    tierKey: "pro",
    price: {
      monthly: 29,
      yearly: 108,
    },
    description: "7-day trial. Core chat plus market tracking.",
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
        description: "Daily prompts to test ideas and get coaching.",
        included: true,
      },
      {
        name: "Live Odds + Score Tracking",
        description: "Real-time lines and scoreboard overlays.",
        included: true,
      },
      {
        name: "EV Tool Calls (1 / Day)",
        description: "Scan for value in team and prop markets.",
        included: true,
      },
      {
        name: "Live Projections (0 / Day)",
        description: "Upgrade to Sharp for live projection chats.",
        included: false,
      },
    ],
  },
  {
    name: "Sharp",
    tierKey: "sharp",
    price: {
      monthly: 59,
      yearly: 249,
    },
    description: "7-day trial. Unlimited chat plus unlimited EV bets.",
    highlight: true,
    badge: "Most Popular",
    planKeyMonthly: "sharp_monthly",
    planKeyYearly: "sharp_annual",
    icon: (
      <div className="relative">
        <TrendingUp className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Messages",
        description: "Chat without daily caps.",
        included: true,
      },
      {
        name: "Live Projection Models",
        description: "Available for Syndicate members only.",
        included: false,
      },
      {
        name: "Unlimited EV Bet Access",
        description: "Run EV scans without daily limits.",
        included: true,
      },
      {
        name: "Live Odds + Score Tracking",
        description: "Every Pro feature included.",
        included: true,
      },
    ],
  },
  {
    name: "Syndicate",
    tierKey: "syndicate",
    price: {
      monthly: 79,
      yearly: 299,
    },
    description: "7-day trial. Unlimited everything plus priority support.",
    planKeyMonthly: "syndicate_monthly",
    planKeyYearly: "syndicate_annual",
    icon: (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300/40 to-emerald-200/25 blur-2xl" />
        <Sigma className="relative z-10 h-7 w-7 text-white" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Messages",
        description: "No caps across any chat type.",
        included: true,
      },
      {
        name: "Live Projection Models",
        description: "Full access to live projection models.",
        included: true,
      },
      {
        name: "Unlimited EV Bet Access",
        description: "Run EV scans without daily limits.",
        included: true,
      },
      {
        name: "Custom Models + VIP Support",
        description: "Build models with priority support.",
        included: true,
      },
    ],
  },
]

export function PricingSectionDemo() {
  return <PricingSection tiers={defaultTiers} />
}
