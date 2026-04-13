'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function HeroSection9() {
  return (
    <div className="relative overflow-hidden border-b border-white/10 bg-black text-white">
      <main>
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block">
          <div className="absolute left-0 top-0 h-[70rem] w-[28rem] -translate-y-80 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(160,60%,65%,.12)_0,hsla(160,40%,35%,.04)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="absolute left-0 top-0 h-[70rem] w-56 -translate-y-80 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(160,55%,70%,.08)_0,hsla(160,40%,35%,.02)_80%,transparent_100%)]" />
        </div>

        <section className="overflow-hidden bg-black">
          <div className="relative mx-auto max-w-6xl px-6 py-24">
            <div className="relative z-10 mx-auto max-w-3xl text-center">
              <h1 className="text-balance text-5xl font-semibold leading-tight tracking-tight text-white xl:text-6xl">
                <span className="block">Sports betting intel</span>
                <span className="block">made simple.</span>
              </h1>
              <p className="mx-auto my-8 max-w-2xl text-xl text-zinc-300">
                Pick your sport. Follow market signals. That&apos;s it.
              </p>

              <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:gap-4">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="flex-1 border-emerald-300/60 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 hover:text-emerald-50"
                >
                  <Link href="#features">
                    <span>Features</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="flex-1 bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                >
                  <Link href="/auth/signup">
                    <span>Get Instant Access</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-auto -mt-12 max-w-7xl [mask-image:linear-gradient(to_bottom,black_58%,transparent_100%)]">
            <div className="[perspective:1200px] -mr-20 pl-20 [mask-image:linear-gradient(to_right,black_40%,transparent_100%)] lg:-mr-64 lg:pl-64">
              <div className="[transform:rotateX(18deg)]">
                <div className="relative skew-x-[.28rad]">
                  <img
                    className="relative z-[2] rounded-2xl border border-white/15"
                    src="/landingpageimage.png"
                    alt="Desktop analytics dashboard"
                    width={2880}
                    height={1900}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
