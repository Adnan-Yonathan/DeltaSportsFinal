import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQS = [
  {
    question: 'What do I get with Delta Sports?',
    answer:
      'You get access to Sharp Projections, Sharp Props, Whale Feed, and Research Mode in one workflow.',
  },
  {
    question: 'Can I cancel any time?',
    answer:
      'Yes. You can cancel from billing settings at any time.',
  },
  {
    question: 'How often is data refreshed?',
    answer:
      'Core market and projection views update throughout the day, with key projection workflows refreshing on a 15-minute cadence.',
  },
  {
    question: 'Is this a picks service?',
    answer:
      'No. Delta Sports is an analytics platform that helps you find and validate edges before you place bets.',
  },
  {
    question: 'Do I need advanced betting experience?',
    answer:
      'No. The product is designed for both newer and experienced bettors with clear workflows and contextual signals.',
  },
  {
    question: 'Where can I get support?',
    answer:
      'You can contact support directly from the platform or by email for account, billing, and product help.',
  },
]

export function WelcomeFaqAndFinalCta() {
  return (
    <section className="space-y-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">FAQ</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
          Everything you need to know about trial, billing, and what is included.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/55 p-2 sm:p-4">
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`faq-${index}`}
              className="rounded-2xl border border-white/10 bg-black/50 px-4 data-[state=open]:border-emerald-400/35"
            >
              <AccordionTrigger className="text-left text-base font-semibold text-white hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-white/70">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-black p-8 text-center sm:p-12">
        {/* Glow blast from bottom */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_110%,rgba(52,211,153,0.22),transparent_65%)]" />
        <div className="insider-scanlines pointer-events-none absolute inset-0 opacity-[0.15]" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">
            <span className="ob-live-dot" />
            1,000+ members active right now
          </div>

          <h3 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Right now, bettors on Delta are
            <br className="hidden sm:block" />
            {' '}watching lines the public hasn&apos;t seen yet.
          </h3>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/58 sm:text-base">
            Join them in 60 seconds. All plans include a 3-day free trial — cancel before day 3 and you pay nothing.
          </p>

          <Link
            href="/auth/signup"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3CCB97] px-7 py-3.5 text-sm font-bold text-black transition-all hover:bg-[#52d8a8] hover:shadow-[0_0_40px_rgba(52,211,153,0.45)]"
          >
            Join 1,000+ members — start free
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/30">
            <span>Stripe secure</span>
            <span className="text-white/15">·</span>
            <span>Cancel before day 3, pay nothing</span>
            <span className="text-white/15">·</span>
            <span>Instant access to all 4 tools</span>
          </div>
        </div>
      </div>
    </section>
  )
}
