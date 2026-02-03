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
    question: "Is Delta Sports an AI sports betting tool or a pick service?",
    answer:
      "Delta Sports is an AI sports betting assistant for sharp betting analysis. It helps you analyze sharp action, sharp money flow, and line movement, but it does not place bets or guarantee picks.",
  },
  {
    question: "What is sharp action and how do you track it?",
    answer:
      "Sharp action is informed betting activity that moves a line. We track sharp money signals, line movement history, and market context so you can see where pressure is building.",
  },
  {
    question: "How does the AI help with sharp betting?",
    answer:
      "The AI summarizes key line moves, compares prices across books, and explains why a sharp money signal is meaningful. It turns raw betting data into actionable sharp betting insights.",
  },
  {
    question: "Do I need my own models to use the tools?",
    answer:
      "No. You can use the built-in workflows for AI sports betting, sharp action research, and line shopping without building models. Advanced users can still layer in their own numbers.",
  },
]

const highlights = [
  "No contracts - cancel anytime",
  "Line-shopping workflows",
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
              We obsess over making Delta Sports AI the fastest path from idea to
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

