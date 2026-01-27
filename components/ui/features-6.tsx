import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'

interface FeaturesSixProps {
  title?: string
  description?: string
  imageSrc?: string
  imageAlt?: string
}

export function FeaturesSix({
  title = 'A platform that turns you into a sharp',
  description = 'Stay synced to live market movement while your projections update for games, players, and parlays in one flow.',
  imageSrc = '/Screenshot 2026-01-11 170628.png',
  imageAlt = 'Delta interface preview',
}: FeaturesSixProps) {
  return (
    <section className="bg-black py-16 text-white md:py-32">
      <div className="mx-auto max-w-5xl space-y-12 px-6">
        <div className="relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12">
          <h2 className="text-4xl font-semibold">{title}</h2>
          <p className="max-w-sm text-sm text-white/70 sm:ml-auto">
            {description}
          </p>
        </div>
        <div className="relative rounded-3xl p-3 md:-mx-8 lg:col-span-3">
          <div className="relative aspect-[88/36]">
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black to-transparent"></div>
            <img
              src={imageSrc}
              className="absolute inset-0 z-10 h-full w-full object-cover"
              alt={imageAlt}
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
              Track line movement and news impacts as they happen.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="size-4" />
              <h3 className="text-sm font-medium">Powerful</h3>
            </div>
            <p className="text-sm text-white/60">
              Break down sharp money flow by market, book, and timing.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="size-4" />
              <h3 className="text-sm font-medium">Accurate</h3>
            </div>
            <p className="text-sm text-white/60">
              Validate edges with clean, source-verified splits and logs.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <h3 className="text-sm font-medium">AI Powered</h3>
            </div>
            <p className="text-sm text-white/60">
              Research-mode summaries explain why the market is moving.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
