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
    description: "7-day trial. Top spread projection per sport.",
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
        name: "Top Spread Projection",
        description: "One best spread projection per sport.",
        included: true,
      },
      {
        name: "Moneyline + Total Projections",
        description: "Locked until Sharp or Syndicate.",
        included: false,
      },
      {
        name: "Sharp Props",
        description: "Upgrade to Sharp for player edges and props.",
        included: false,
      },
      {
        name: "Parlay Pro",
        description: "Upgrade to Sharp for parlay modeling.",
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
    description: "7-day trial. Projections + sharp props + parlay pro.",
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
        name: "5 Projections per Market",
        description: "Top 5 for spreads, moneylines, and totals.",
        included: true,
      },
      {
        name: "Sharp Props",
        description: "Market-driven player edges and props.",
        included: true,
      },
      {
        name: "Parlay Pro",
        description: "True parlay odds with correlation adjustments.",
        included: true,
      },
      {
        name: "Whale Feed",
        description: "Available in Syndicate only.",
        included: false,
      },
      {
        name: "Live Projections + Line Shopping",
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
    description: "7-day trial. Unlimited access to every tool.",
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
        name: "Unlimited Sharp Projections",
        description: "Full access to spreads, moneylines, and totals.",
        included: true,
      },
      {
        name: "Whale Feed",
        description: "Real-time sharp trade alerts and tags.",
        included: true,
      },
      {
        name: "Sharp Props",
        description: "Player prop edges and scores.",
        included: true,
      },
      {
        name: "Parlay Pro",
        description: "EV parlays + correlation-aware builder.",
        included: true,
      },
      {
        name: "Live Projections + Line Shopping",
        description: "In-game projections plus pregame odds board.",
        included: true,
      },
    ],
  },
]

export function PricingSectionDemo() {
  return <PricingSection tiers={defaultTiers} />
}
