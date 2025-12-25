"use client"

import { ArrowDownToDot, Sigma, Zap } from "lucide-react"
import { PricingSection, type PricingTier } from "@/components/ui/pricing-section"

const STRIPE_LINKS = {
  proTrial: "https://buy.stripe.com/fZu7sE6OY4Ct2Nr3Vyawo00",
  proMonthly: "https://buy.stripe.com/bJe6oAa1aglbds53Vyawo03",
  proAnnual: "https://buy.stripe.com/28E5kw8X6fh74VzgIkawo04",
  unlimitedMonthly: "https://buy.stripe.com/14A7sE1uE6KBfAd4ZCawo01",
  unlimitedAnnual: "https://buy.stripe.com/aFa3coc9i8SJ0Fj3Vyawo02",
}

const defaultTiers: PricingTier[] = [
  {
    name: "Pro Trial",
    price: {
      monthly: 0,
      yearly: 0,
    },
    description: "Free 7-day trial. No card required to start.",
    badge: "Trial",
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
    checkoutUrlMonthly: STRIPE_LINKS.proTrial,
    checkoutUrlYearly: STRIPE_LINKS.proTrial,
    planKeyMonthly: "pro_trial",
    planKeyYearly: "pro_trial",
  },
  {
    name: "Pro",
    price: {
      monthly: 29,
      yearly: 9, // annual price per month
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
    checkoutUrlMonthly: STRIPE_LINKS.proMonthly,
    checkoutUrlYearly: STRIPE_LINKS.proAnnual,
    planKeyMonthly: "pro_monthly",
    planKeyYearly: "pro_annual",
  },
  {
    name: "Unlimited",
    price: {
      monthly: 199,
      yearly: 83, // annual price per month
    },
    description: "Unlimited chat, custom model builder, and premium support.",
    icon: (
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300/40 to-emerald-200/25 blur-2xl" />
        <Sigma className="relative z-10 h-7 w-7 text-white" />
      </div>
    ),
    features: [
      {
        name: "Unlimited Messages",
        description: "Brainstorm without limits - ask Delta AI anything, anytime.",
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
    checkoutUrlMonthly: STRIPE_LINKS.unlimitedMonthly,
    checkoutUrlYearly: STRIPE_LINKS.unlimitedAnnual,
    planKeyMonthly: "unlimited_monthly",
    planKeyYearly: "unlimited_annual",
  },
]

export function PricingSectionDemo() {
  return <PricingSection tiers={defaultTiers} />
}

