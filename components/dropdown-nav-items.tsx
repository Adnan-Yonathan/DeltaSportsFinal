"use client"

import {
  Activity,
  DollarSign,
  Eye,
  MessageSquare,
  Percent,
  Radar,
  Instagram,
  Twitter,
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
            label: "Whale Feed",
            description: "Large-ticket flow and clustering",
            icon: Activity,
            href: "/sharp-detector",
          },
          {
            label: "Insider Feed",
            description: "Top Polymarket wallet positions",
            icon: Eye,
            href: "/polymarket-insider",
          },
          {
            label: "Sharp Props",
            description: "Prediction market order books",
            icon: Percent,
            href: "/sharp-props",
          },
          {
            label: "Sharp Movement",
            description: "Pinnacle line movement + limit expansion",
            icon: Radar,
            href: "/market-projections",
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
            label: "Sharp Movement",
            description: "How to read line movement and limits",
            icon: Radar,
            href: "/tools/sharp-projections",
          },
          {
            label: "Sharp Props",
            description: "Orderbook signals and liquidity walls",
            icon: Percent,
            href: "/tools/sharp-props",
          },
          {
            label: "Whale Feed",
            description: "How to use live whale tape and clustering",
            icon: Activity,
            href: "/tools/whale-feed",
          },
          {
            label: "Insider Feed",
            description: "Follow top-ROI Polymarket wallets",
            icon: Eye,
            href: "/tools/insider-feed",
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
            href: "/auth/signup",
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
            href: "https://discord.gg/SBB4QAQQ",
            external: true,
          },
          {
            label: "Instagram",
            description: "Follow @deltasportsai",
            icon: Instagram,
            href: "https://www.instagram.com/deltasportsai?igsh=dXcweHRiNGt5eXQ2",
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
