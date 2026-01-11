import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'

export function FeaturesSix() {
  return (
    <section className="bg-black py-16 text-white md:py-32">
      <div className="mx-auto max-w-5xl space-y-12 px-6">
        <div className="relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12">
          <h2 className="text-4xl font-semibold">
            A platform that turns you into a sharp
          </h2>
          <p className="max-w-sm text-sm text-white/70 sm:ml-auto">
            Stay synced to live market movement while your projections update for
            games, players, and parlays in one flow.
          </p>
        </div>
        <div className="relative rounded-3xl p-3 md:-mx-8 lg:col-span-3">
          <div className="relative aspect-[88/36]">
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black to-transparent"></div>
            <img
              src="/Screenshot 2026-01-11 170628.png"
              className="absolute inset-0 z-10 h-full w-full object-cover"
              alt="Delta interface preview"
              width={2797}
              height={1137}
            />
          </div>
        </div>
        <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4" />
              <h3 className="text-sm font-medium">Fast</h3>
            </div>
            <p className="text-sm text-white/60">
              Sharp signals and movement alerts update every minute.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="size-4" />
              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-sm text-white/60">
              Model projections adapt to market shifts instantly.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="size-4" />
              <h3 className="text-sm font-medium">Accurate</h3>
            </div>
            <p className="text-sm text-white/60">
              Market tracking stays accurate as lines shift and money hits.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <h3 className="text-sm font-medium">AI Powered</h3>
            </div>
            <p className="text-sm text-white/60">
              Our LLM teaches betting concepts and points you to the best places to find a bet.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
