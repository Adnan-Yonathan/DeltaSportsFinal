"use client"

import { ArrowDownToDot, Sigma, TrendingUp } from "lucide-react"
import { PricingSection, type PricingTier } from "@/components/ui/pricing-section"

const defaultTiers: PricingTier[] = [
  {
    name: "Pro",
    tierKey: "pro",
    price: {
      weekly: 9.99,
      monthly: 29,
      yearly: 108,
    },
    description: "7-day trial. Core chat plus market tracking.",
    planKeyWeekly: "pro_weekly",
    planKeyMonthly: "pro_monthly",
    planKeyYearly: "pro_annual",
    icon: (
      <div className="relative">
        <ArrowDownToDot className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "Chat + Stats Center",
        description: "Conversational breakdowns with team and player stats.",
        included: true,
      },
      {
        name: "Sharp Detector",
        description: "Track sharp action and market sentiment.",
        included: true,
      },
      {
        name: "Sharp Money Feed",
        description: "Real-time sharp money alerts (Syndicate only).",
        included: false,
      },
      {
        name: "Sharp Projections",
        description: "Projected spreads, totals, and moneylines.",
        included: true,
      },
      {
        name: "Player Projections",
        description: "Upgrade to Sharp for player edges and props.",
        included: false,
      },
    ],
  },
  {
    name: "Sharp",
    tierKey: "sharp",
    price: {
      weekly: 19.99,
      monthly: 59,
      yearly: 249,
    },
    description: "7-day trial. Player projections and parlay modeling.",
    planKeyWeekly: "sharp_weekly",
    planKeyMonthly: "sharp_monthly",
    planKeyYearly: "sharp_annual",
    icon: (
      <div className="relative">
        <TrendingUp className="relative z-10 h-7 w-7 text-black" />
      </div>
    ),
    features: [
      {
        name: "Everything in Pro",
        description: "Sharp detector, sharp projections, and stats.",
        included: true,
      },
      {
        name: "Sharp Money Feed",
        description: "Syndicate-only sharp money alerts.",
        included: false,
      },
      {
        name: "Player Projections",
        description: "Market-driven player edges and props.",
        included: true,
      },
      {
        name: "Parlay Pro",
        description: "True parlay odds with correlation adjustments.",
        included: true,
      },
      {
        name: "EV Bets + Live Projections",
        description: "Available in Syndicate only.",
        included: false,
      },
    ],
  },
  {
    name: "Syndicate",
    tierKey: "syndicate",
    price: {
      weekly: 24.99,
      monthly: 79,
      yearly: 299,
    },
    description: "7-day trial. EV bets plus live projection access.",
    highlight: true,
    badge: "Most Popular",
    planKeyWeekly: "syndicate_weekly",
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
        name: "Everything in Sharp",
        description: "Player projections + parlay pro included.",
        included: true,
      },
      {
        name: "Sharp Money Feed",
        description: "Real-time sharp money alerts and tags.",
        included: true,
      },
      {
        name: "EV Bets",
        description: "Cross-market EV opportunities across books.",
        included: true,
      },
      {
        name: "Live Projections",
        description: "In-game projections and live updates.",
        included: true,
      },
      {
        name: "Priority Support",
        description: "Fast-track help for custom workflows.",
        included: true,
      },
    ],
  },
]

export function PricingSectionDemo() {
  return <PricingSection tiers={defaultTiers} />
}
