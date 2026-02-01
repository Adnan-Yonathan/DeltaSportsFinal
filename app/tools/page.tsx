import Link from "next/link"
import type { ComponentType } from "react"
import { SimpleHeader } from "@/components/ui/simple-header"
import { TOOLS_CONTENT } from "@/lib/tools-content"
import {
  Activity,
  Clock,
  Eye,
  Layers3,
  LineChart,
  MessageSquare,
  Percent,
  Target,
  Users,
  Zap,
} from "lucide-react"

const TOOL_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  "line-chart": LineChart,
  target: Target,
  layers: Layers3,
  percent: Percent,
  activity: Activity,
  eye: Eye,
  "message-square": MessageSquare,
  clock: Clock,
  users: Users,
  zap: Zap,
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader
        rightSlot={
          <Link
            href="/chat"
            className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
          >
            Back to chat
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_rgba(0,0,0,0.2)_55%)] p-6 text-left sm:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
            Tools Guide
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything Delta does, explained.
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Each tool below includes what it does, how to use it, why it is unique,
            and where it fits in your workflow.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {TOOLS_CONTENT.map((tool) => {
            const Icon = TOOL_ICON_MAP[tool.icon] ?? LineChart
            return (
              <section
                key={tool.id}
                id={tool.id}
                className="scroll-mt-24 rounded-3xl border border-white/10 bg-black/50 p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-200">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                        Tool
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold text-white sm:text-5xl">
                        {tool.label}
                      </h2>
                      <p className="mt-2 text-xs text-white/60 sm:text-sm">
                        {tool.summary}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={tool.route}
                    className="inline-flex items-center rounded-full border border-emerald-400/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
                  >
                    Open tool
                  </Link>
                </div>
                <div className="mt-6 grid gap-5 text-sm text-white/70 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                      What it does
                    </p>
                    <p className="mt-2">{tool.description}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                      How to use
                    </p>
                    <p className="mt-2">{tool.howToUse}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                      Why it is unique
                    </p>
                    <p className="mt-2">{tool.unique}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                      Use cases
                    </p>
                    <ul className="mt-2 space-y-2">
                      {tool.useCases.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
