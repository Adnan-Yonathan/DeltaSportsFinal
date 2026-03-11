import Link from 'next/link'
import { SimpleHeader } from '@/components/ui/simple-header'

export const dynamic = 'force-dynamic'

const SOCIAL_LINKS = [
  {
    label: 'X / Twitter',
    href: 'https://x.com/DeltaSportsAI',
    description: 'Product updates, sharp clips, and release notes.',
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/SBB4QAQQ',
    description: 'Community discussion, alerts, and member chat.',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/deltasportsai?igsh=dXcweHRiNGt5eXQ2',
    description: 'Visual breakdowns, clips, and behind-the-scenes updates.',
  },
]

export default function SocialsPage() {
  return (
    <div className="min-h-screen bg-[#02070f] text-white">
      <SimpleHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">Community</p>
          <h1 className="mt-3 text-3xl font-semibold">Socials</h1>
          <p className="mt-2 text-white/70">
            Follow Delta across channels for updates and live community discussion.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {SOCIAL_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-black/45 p-5 transition hover:border-cyan-300/40 hover:bg-cyan-500/5"
            >
              <h2 className="text-lg font-semibold">{item.label}</h2>
              <p className="mt-2 text-sm text-white/65">{item.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
