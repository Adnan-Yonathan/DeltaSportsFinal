"use client"

import { Check, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const faqs = [
  {
    question: "Do I need previous betting models to use Delta AI?",
    answer:
      "No. Pro includes pre-built workflows for bankroll tracking and market monitoring. Unlimited lets you create statistical models with guided templates - no code required.",
  },
  {
    question: "How does live odds tracking work?",
    answer:
      "We ingest prices from major US and international books in real time. You can tag favorite markets, set alerts, and compare lines before you fire.",
  },
  {
    question: "What counts toward my daily message limit on Pro?",
    answer:
      "Only prompts sent to the Delta AI copilot. System alerts, score updates, and bankroll syncing do not consume your 25-message allowance.",
  },
  {
    question: "Can I invite teammates?",
    answer:
      "Yes. Every plan supports multiple bankrolls per organization. Unlimited offers shared workspaces plus priority support for modeling squads.",
  },
]

const highlights = [
  "No contracts - cancel anytime",
  "Backtested bankroll workflows",
  "Fast support from real bettors",
]

function FAQSection({ className }: { className?: string }) {
  return (
    <section className={cn("w-full py-16 md:py-24", className)}>
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 md:grid-cols-2">
        <div className="space-y-8">
          <div className="space-y-4">
            <Badge variant="outline" className="border-white/30 text-white">
              FAQ
            </Badge>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              Built for serious bettors, explained simply
            </h2>
            <p className="text-base text-white/80 md:text-lg">
              We obsess over making Delta AI the fastest path from idea to
              action. Here are the questions we hear most from sharp bettors
              evaluating the platform.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/15 bg-[#4E4E4E] p-6">
            {highlights.map((item) => (
              <div key={item} className="flex items-center gap-3 text-white">
                <span className="rounded-full bg-white/20 p-1 text-white">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-sm md:text-base">{item}</span>
              </div>
            ))}
            <Button
              asChild
              variant="outline"
              className="mt-4 w-full gap-2 border-[#34d399] bg-[#34d399] text-[#0f1f15] hover:bg-[#16a34a] hover:border-[#16a34a]"
            >
              <a href="mailto:support@delta.ai">
                Email us anytime
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export { FAQSection }
