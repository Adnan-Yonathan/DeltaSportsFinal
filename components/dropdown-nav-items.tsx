"use client"

import {
  Beaker,
  DollarSign,
  FileText,
  LineChart,
  MessageSquare,
  Percent,
  Radar,
  Radio,
  TrendingUp,
  Twitter,
  Waves,
  Zap,
} from "lucide-react"

import type { DropdownNavigationItem } from "@/components/ui/dorpdown-navigation"

export const DROPDOWN_NAV_ITEMS: DropdownNavigationItem[] = [
  {
    id: 1,
    label: "Tools",
    subMenus: [
      {
        title: "Projections",
        items: [
          {
            label: "Sharp Projections",
            description: "Market-driven lines + edges",
            icon: Radar,
            href: "/market-projections",
          },
          {
            label: "Sharp Props",
            description: "Order books + crossed EV",
            icon: Percent,
            href: "/crossed-ev",
          },
          {
            label: "Sharp Traders",
            description: "Track profitable wallets",
            icon: Zap,
            href: "/sharp-traders",
          },
          {
            label: "Whale Feed",
            description: "Big money alerts + clustering",
            icon: Waves,
            href: "/sharp-detector",
          },
        ],
      },
      {
        title: "Research",
        items: [
          {
            label: "Sharp Action",
            description: "Why sharps are targeting games",
            icon: Beaker,
            href: "/research/sharp-action",
          },
          {
            label: "Betting Trends",
            description: "ATS + historical trends",
            icon: TrendingUp,
            href: "/research/betting-trends",
          },
          {
            label: "Backtesting",
            description: "Simulate strategies on historical odds",
            icon: LineChart,
            href: "/research/backtesting",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    label: "Guides",
    subMenus: [
      {
        title: "Guides",
        items: [
          {
            label: "Sharp Projections",
            description: "How to read market edges",
            icon: Radar,
            href: "/tools/sharp-projections",
          },
          {
            label: "Sharp Props",
            description: "Crossed EV + order books",
            icon: Percent,
            href: "/tools/sharp-props",
          },
          {
            label: "Sharp Traders",
            description: "Track wallets and positions",
            icon: Zap,
            href: "/tools/sharp-traders",
          },
          {
            label: "Whale Feed",
            description: "Big money alerts",
            icon: Waves,
            href: "/tools/whale-feed",
          },
        ],
      },
      {
        title: "Company",
        items: [
          {
            label: "Pricing",
            description: "Start your free trial",
            icon: DollarSign,
            href: "/pricing",
          },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Socials",
    subMenus: [
      {
        title: "Community",
        items: [
          {
            label: "Twitter / X",
            description: "Follow @DeltaSportsAI",
            icon: Twitter,
            href: "https://x.com/DeltaSportsAI",
            external: true,
          },
          {
            label: "Discord",
            description: "Join the community",
            icon: MessageSquare,
            href: "https://discord.gg/vPsUZpjv",
            external: true,
          },
        ],
      },
    ],
  },
  {
    id: 4,
    label: "Blog",
    link: { href: "/blog" },
  },
  {
    id: 5,
    label: "Live",
    link: { href: "/live-scores" },
  },
  {
    id: 6,
    label: "Pricing",
    link: { href: "/pricing" },
  },
]
