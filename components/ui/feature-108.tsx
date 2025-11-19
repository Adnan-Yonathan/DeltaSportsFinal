"use client"

import React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { Layout, Pointer, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface TabContent {
  badge: string
  title: string
  description: string
  buttonText: string
  imageSrc: string
  imageAlt: string
}

interface Tab {
  value: string
  icon: React.ReactNode
  label: string
  content: TabContent
}

interface Feature108Props {
  badge?: string
  heading?: string
  description?: string
  tabs?: Tab[]
}

const Feature108 = ({
  badge = "Delta AI",
  heading = "Experience Delta AI in Action",
  description = "Chat with AI, compare odds, and track your bankroll all in one powerful interface.",
  tabs = [
    {
      value: "tab-1",
      icon: <Zap className="h-auto w-4 shrink-0" />,
      label: "AI Copilot",
      content: {
        badge: "Chat Workflow",
        title: "Real-time edges in natural language",
        description:
          "Drop any matchup or prop and Delta AI instantly parses odds, recent form, and your model preferences to surface actionable bets.",
        buttonText: "Launch Chat",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-1.svg",
        imageAlt: "chat-preview",
      },
    },
    {
      value: "tab-2",
      icon: <Pointer className="h-auto w-4 shrink-0" />,
      label: "Odds Intelligence",
      content: {
        badge: "Shop Faster",
        title: "Best price across every book",
        description:
          "Delta scans FanDuel, DraftKings, Caesars, Pinnacle and more, highlighting the top spread, total, and prop prices with automatic EV math.",
        buttonText: "See Odds View",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-2.svg",
        imageAlt: "odds-preview",
      },
    },
    {
      value: "tab-3",
      icon: <Layout className="h-auto w-4 shrink-0" />,
      label: "Bankroll Coach",
      content: {
        badge: "Kelly + Tracking",
        title: "Disciplined staking & insights",
        description:
          "Log every wager, calculate Kelly sizing, and visualize ROI, CLV, and unit trends so you always know your edge and leaks.",
        buttonText: "Open Dashboard",
        imageSrc: "https://shadcnblocks.com/images/block/placeholder-dark-3.svg",
        imageAlt: "bankroll-preview",
      },
    },
  ],
}: Feature108Props) => {
  return (
    <section className="py-24">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline">{badge}</Badge>
          <h2 className="max-w-2xl text-3xl font-semibold md:text-4xl">{heading}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <TabsPrimitive.Root defaultValue={tabs[0].value} className="mt-8">
          <TabsPrimitive.List className="container flex flex-col items-center justify-center gap-4 sm:flex-row md:gap-10">
            {tabs.map((tab) => (
              <TabsPrimitive.Trigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-primary"
              >
                {tab.icon} {tab.label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <div className="mx-auto mt-8 max-w-screen-xl rounded-2xl bg-muted/70 p-6 lg:p-16">
            {tabs.map((tab) => (
              <TabsPrimitive.Content
                key={tab.value}
                value={tab.value}
                className="grid place-items-center gap-20 lg:grid-cols-2 lg:gap-10"
              >
                <div className="flex flex-col gap-5">
                  <Badge variant="outline" className="w-fit bg-background">
                    {tab.content.badge}
                  </Badge>
                  <h3 className="text-3xl font-semibold lg:text-5xl">{tab.content.title}</h3>
                  <p className="text-muted-foreground lg:text-lg">{tab.content.description}</p>
                  <Button className="mt-2.5 w-fit gap-2" size="lg">
                    {tab.content.buttonText}
                  </Button>
                </div>
                <img src={tab.content.imageSrc} alt={tab.content.imageAlt} className="rounded-xl" />
              </TabsPrimitive.Content>
            ))}
          </div>
        </TabsPrimitive.Root>
      </div>
    </section>
  )
}

export { Feature108 }
