"use client"

import { Button } from "@/components/ui/button"
import { FlippingCard } from "@/components/ui/flipping-card"
import Link from "next/link"

interface CardData {
  front: {
    title: string
    description: string
    icon: React.ReactNode
  }
  back: {
    description: string
    buttonText: string
  }
}

const featureCards: Array<CardData & { id: string }> = [
  {
    id: "sharp-projections",
    front: {
      title: "Sharp Movement",
      description: "Line movement and limit expansion in one board.",
      icon: <KnifeIcon />,
    },
    back: {
      description:
        "Track opening-to-current movement across spreads, totals, and moneylines to spot pressure before the board settles.",
      buttonText: "View Guide",
    },
  },
  {
    id: "sharp-props",
    front: {
      title: "Sharp Props",
      description: "Live prop orderbook walls and sharp lean signals.",
      icon: <WaterfallIcon />,
    },
    back: {
      description:
        "Scan resting liquidity, read over/under pressure, and compare sharp lean odds before you fire.",
      buttonText: "View Guide",
    },
  },
  {
    id: "whale-feed",
    front: {
      title: "Whale Feed",
      description: "Large-ticket market flow surfaced in real time.",
      icon: <WhaleIcon />,
    },
    back: {
      description:
        "Track high-notional tickets, check repeated game clusters, and validate moves before you execute.",
      buttonText: "View Whale Feed",
    },
  },
]

export default function StatsSection({ showCards = true }: { showCards?: boolean }) {
  return (
    <section className="w-full -mt-2 lg:-mt-4">
        <div className="py-0">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="space-y-6 text-center">
            <div className="flex w-full justify-center">
              <Button
                asChild
                size="lg"
                className="h-12 w-full justify-center text-sm bg-[#34d399] text-black hover:bg-[#16a34a] sm:w-72 sm:text-base shadow-[0_18px_60px_rgba(16,185,129,0.22)]"
              >
                <Link href="/auth/signup">Start your free trial</Link>
              </Button>
            </div>
          </div>
        </div>
        {showCards && (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
            <div className="flex flex-nowrap items-center justify-start gap-4 overflow-x-auto rounded-3xl border border-white/10 bg-black/60 px-4 py-6 shadow-[0_22px_60px_rgba(0,0,0,0.4)] backdrop-blur sm:justify-center sm:gap-6">
              {featureCards.map((card) => (
                <div key={card.id} className="h-[280px] w-[240px] shrink-0">
                  <FlippingCard
                    width={240}
                    height={280}
                    frontContent={<GenericCardFront data={card.front} />}
                    backContent={<GenericCardBack id={card.id} data={card.back} />}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function GenericCardFront({ data }: { data: CardData["front"] }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
        {data.icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold">{data.title}</h3>
        <p className="mt-2 text-sm text-white/70">{data.description}</p>
      </div>
    </div>
  )
}

function GenericCardBack({
  id,
  data,
}: {
  id: string
  data: CardData["back"]
}) {
  const hrefById: Record<string, string> = {
    "sharp-projections": "/tools/sharp-projections",
    "sharp-props": "/tools/sharp-props",
    "whale-feed": "/tools/whale-feed",
  }
  const href = hrefById[id] ?? "/tools"

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-6 text-white">
      <p className="mt-2 text-center text-[13.5px] text-white/80">
        {data.description}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-white px-4 text-[13.5px] font-semibold text-black transition-transform hover:-translate-y-[1px]"
      >
        {data.buttonText}
      </Link>
    </div>
  )
}

function KnifeIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 text-white" fill="none">
      <path
        d="M10 44c6-8 18-16 34-20 4-1 10-1 10 3 0 3-4 5-7 6-12 4-22 9-28 16l-9-5z"
        fill="currentColor"
      />
      <path
        d="M10 44l-4 6 8 4 5-5-9-5z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}

function MaskIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 text-white" fill="none">
      <path
        d="M8 20c8-6 40-6 48 0v16c0 10-10 18-24 18S8 46 8 36V20z"
        fill="currentColor"
      />
      <circle cx="22" cy="32" r="4" fill="#0b1220" />
      <circle cx="42" cy="32" r="4" fill="#0b1220" />
      <path
        d="M22 42c6 4 14 4 20 0"
        stroke="#0b1220"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function WhaleIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 text-white" fill="none">
      <path
        d="M10 36c2-10 14-18 28-18 10 0 18 4 22 10 2 3 2 8-2 10-4 2-8 0-10-3l-2-4c-2 6-10 10-20 10-6 0-12-2-16-5z"
        fill="currentColor"
      />
      <circle cx="36" cy="26" r="2" fill="#0b1220" />
      <path
        d="M50 22c3-6 8-8 12-8-2 6-4 10-10 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function WaterfallIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 text-white" fill="none">
      <path
        d="M12 18h40l-6 8H18l-6-8z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M20 26v20M32 26v24M44 26v18"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M16 48c8 4 24 4 32 0"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

