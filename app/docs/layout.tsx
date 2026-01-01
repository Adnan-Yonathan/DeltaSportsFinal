import type { ReactNode } from "react"
import Link from "next/link"

const sections = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/data-sources", label: "Data & Refresh" },
  { href: "/docs/chat-playbook", label: "Chat Playbook" },
  { href: "/docs/bankroll", label: "Bankroll & Bets" },
  { href: "/docs/models", label: "Custom Models" },
  { href: "/docs/responsible-gaming", label: "Responsible Gaming" },
]

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:flex-row">
        <aside className="w-full shrink-0 border-b border-white/10 pb-4 text-sm text-white/70 lg:w-64 lg:border-b-0 lg:border-r lg:pr-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            Docs
          </p>
          <h1 className="mt-2 text-xl font-semibold">Delta Sports Guide</h1>
          <nav className="mt-4 space-y-1">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="block rounded-full px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="w-full max-w-2xl flex-1 space-y-4">{children}</section>
      </main>
    </div>
  )
}

