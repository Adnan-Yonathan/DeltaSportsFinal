"use client"

import {
  Beaker,
  DollarSign,
  FileText,
  MessageSquare,
  Percent,
  Radar,
  Radio,
  Instagram,
  Twitter,
  Waves,
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
            description: "Prediction market order books",
            icon: Percent,
            href: "/sharp-props",
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
            description: "Orderbook signals and liquidity walls",
            icon: Percent,
            href: "/tools/sharp-props",
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
            href: "https://discord.gg/NgCgk47N",
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
