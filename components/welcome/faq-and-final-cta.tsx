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

      <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-black p-7 text-center sm:p-10">
        <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80">Final Step</p>
        <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Start your 7-day free trial</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
          Get instant access to Sharp Projections, Sharp Props, Whale Feed, and Research Mode.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#3CCB97] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#52d8a8]"
        >
          Get started now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
