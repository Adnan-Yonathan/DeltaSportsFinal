import type { Metadata } from 'next'
import Link from 'next/link'
import { SimpleHeader } from '@/components/ui/simple-header'

export const metadata: Metadata = {
  title: 'Sharp Betting Tools | Delta Sports',
  description:
    'Sharp betting tools for serious bettors: sharp action research, sharp money signals, line shopping, AI projections, and real-time market movement. Find sharp bets faster with Delta Sports.',
  alternates: {
    canonical: 'https://deltasports.app/sharp-betting-tools',
  },
  openGraph: {
    title: 'Sharp Betting Tools | Delta Sports',
    description:
      'Sharp betting tools for serious bettors: sharp action research, sharp money signals, line shopping, AI projections, and real-time market movement.',
    url: 'https://deltasports.app/sharp-betting-tools',
    siteName: 'Delta Sports',
    type: 'website',
  },
  twitter: {
    title: 'Sharp Betting Tools | Delta Sports',
    description:
      'Sharp betting tools for serious bettors: sharp action research, sharp money signals, line shopping, AI projections, and real-time market movement.',
  },
}

const TOOL_PILLARS = [
  {
    title: 'Sharp Money Signals',
    description:
      'Track market movement, bet splits, and line moves to spot sharp action before it hits the public.',
  },
  {
    title: 'Line Shopping',
    description:
      'Compare books in seconds and capture the best number for spreads, totals, and moneylines.',
  },
  {
    title: 'AI Projections',
    description:
      'Model-driven projections that align with market behavior so you can price edges quickly.',
  },
  {
    title: 'Live Market Tools',
    description:
      'React to in-game movement with live projections, real-time odds, and instant sharp money alerts.',
  },
]

const USE_CASES = [
  {
    title: 'Where to find sharp bets',
    description:
      'Use sharp money signals plus line shopping to identify where pros are shaping the market and creating sharp action.',
  },
  {
    title: 'Betting for sharps',
    description:
      'Quantify your edge with AI projections, then validate with market movement and price history.',
  },
  {
    title: 'Sharp betting software',
    description:
      'All-in-one tools to replace spreadsheets: odds comparison, projections, and alerts in one workspace.',
  },
]

const FAQS = [
  {
    question: 'What are sharp betting tools?',
    answer:
      'Sharp betting tools help you find efficient lines by tracking sharp action, monitoring sharp money signals, comparing odds, and modeling true prices.',
  },
  {
    question: 'How do I find sharp bets?',
    answer:
      'Start with sharp money signals, confirm the best line via line shopping, and compare against AI projections plus line movement history.',
  },
  {
    question: 'Is Delta Sports betting software?',
    answer:
      'Delta Sports is an AI sports betting assistant for analytics, projections, sharp money tracking, and sharp action research. It does not place bets.',
  },
]

export default function SharpBettingToolsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Delta Sports',
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        description:
          'Sharp betting tools for serious bettors: sharp action research, sharp money signals, line shopping, AI projections, and real-time market movement.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          category: 'FreeTrial',
        },
        url: 'https://deltasports.app/sharp-betting-tools',
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      <SimpleHeader />

      <main className="pt-20">
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12">
          <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-black to-black p-8 md:p-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">
              Sharp Betting Tools
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sharp betting tools built for serious bettors.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/70">
              Delta Sports gives you sharp money signals, sharp action research, line shopping,
              AI projections, and real-time market movement so you can find sharp bets faster and
              price every angle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-emerald-300"
              >
                Open The Tools
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-emerald-400/60 hover:text-emerald-200"
              >
                View Plans
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-12">
          <div className="grid gap-4 md:grid-cols-2">
            {TOOL_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <h2 className="text-lg font-semibold text-white">{pillar.title}</h2>
                <p className="mt-2 text-sm text-white/70">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-16">
          <div className="rounded-3xl border border-white/10 bg-black/60 p-8 md:p-10">
            <h2 className="text-2xl font-semibold">Use cases for sharp sports betting</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {USE_CASES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <p className="text-sm font-semibold text-emerald-200">{item.title}</p>
                  <p className="mt-2 text-sm text-white/70">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-16">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black via-black to-emerald-400/10 p-8 md:p-10">
            <h2 className="text-2xl font-semibold">Why Delta Sports for sharp betting</h2>
            <ul className="mt-6 grid gap-3 text-sm text-white/70 md:grid-cols-2">
              <li className="rounded-xl border border-white/10 bg-white/5 p-4">
                See line movement, sharp action, bet splits, and sharp indicators in one workspace.
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-4">
                Compare odds instantly to lock the best price before it moves.
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-4">
                Use AI projections that stay aligned with the betting market.
              </li>
              <li className="rounded-xl border border-white/10 bg-white/5 p-4">
                Track live edges with real-time odds and in-game projections.
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <div className="rounded-3xl border border-white/10 bg-black/70 p-8 md:p-10">
            <h2 className="text-2xl font-semibold">Sharp betting FAQ</h2>
            <div className="mt-6 space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm text-white/70">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
