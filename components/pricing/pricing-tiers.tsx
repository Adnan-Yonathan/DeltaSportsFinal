import { Sigma, TrendingUp } from "lucide-react"
import type { PricingTier } from "@/components/ui/pricing-section"

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Sharp",
    tierKey: "sharp",
    price: {
      weekly: 19.99,
      monthly: 59,
      yearly: 249,
    },
    description: "Sharp projections + sharp props.",
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
        name: "Sharp Projections",
        description: "Full spreads, totals, and moneylines.",
        included: true,
      },
      {
        name: "Sharp Props",
        description: "Player prop edges and scores.",
        included: true,
      },
      {
        name: "Research Tools",
        description: "Upgrade to Syndicate for research mode.",
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
    description: "Whale feed, research mode.",
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
        description: "Sharp projections and sharp props.",
        included: true,
      },
      {
        name: "Research Mode",
        description: "Sharp action, trends, backtesting.",
        included: true,
      },
      {
        name: "Whale Feed",
        description: "Sharp money feed + alerts.",
        included: true,
      },
    ],
  },
]
