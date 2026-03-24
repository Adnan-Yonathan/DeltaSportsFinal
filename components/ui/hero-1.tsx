"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, RocketIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SpecialText } from "@/components/ui/special-text";
import ShimmerText from "@/components/ui/shimmer-text";

const ACCENT = "#3CCB97";

type HeroSectionProps = {
  className?: string;
};

export function HeroSection({ className }: HeroSectionProps) {
  const reduceMotion = useReducedMotion();

  const fadeUp = {
    initial: reduceMotion ? undefined : { opacity: 0, y: 12 },
    animate: reduceMotion ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: "easeOut" as const },
  };

  return (
    <section
      className={cn(
        "relative isolate mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] bg-black",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(72%_80%_at_50%_0%,rgba(60,203,151,0.1),rgba(0,0,0,0.88)_55%,rgba(0,0,0,1)_100%)]" />

      <div className="relative z-10 mx-auto flex w-full flex-col items-center px-6 pb-2 pt-2 text-center lg:px-10">
        <motion.a
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.04 }}
          href="#betproof-showcase"
          className="group inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs shadow"
          style={{
            borderColor: "rgba(60,203,151,0.35)",
            backgroundColor: "rgba(60,203,151,0.08)",
            color: ACCENT,
          }}
        >
          <RocketIcon className="size-3" />
          <span>trusted by 1000+ bettors</span>
          <span className="h-5 border-l" style={{ borderColor: "rgba(60,203,151,0.35)" }} />
          <ArrowRightIcon className="size-3 duration-150 ease-out group-hover:translate-x-1" />
        </motion.a>

        <motion.h1
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className={cn(
            "mt-2 max-w-3xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl",
            "[text-shadow:0_0_42px_rgba(60,203,151,0.22)]"
          )}
          style={{ color: "#ffffff" }}
        >
          <SpecialText speed={18} delay={0.05} className="h-auto leading-[1.06] !font-sans !font-semibold">
            See sharp money before the line moves.
          </SpecialText>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.18 }}
          className="mt-1.5 max-w-2xl text-balance text-sm tracking-wide text-white/90"
        >
          <SpecialText speed={12} delay={0.4} className="h-auto leading-relaxed !font-sans !font-normal text-white">
            Live whale alerts, edge-ranked projections, and orderbook pressure: before books adjust.
          </SpecialText>
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.24 }}
          className="mt-3 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg" className="rounded-full px-7 text-black" style={{ backgroundColor: ACCENT }}>
            <a href="/auth/signup">
              <ShimmerText className="font-semibold text-black" duration={1.2} delay={0.3}>
                Try 7 days free
              </ShimmerText>
              <ArrowRightIcon className="ml-2 size-4" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-white/30 bg-black/35 px-7 text-white hover:bg-white/10"
          >
            <a href="#calculate-your-edge">
              Calculate your profit
              <ArrowRightIcon className="ml-2 size-4" />
            </a>
          </Button>
        </motion.div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.28 }}
          className="relative mt-2 w-full max-w-5xl overflow-hidden"
        >
          <div className="rounded-t-[18px] border border-white/15 bg-[#020810] p-2 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
            <div className="relative aspect-[1860/520] overflow-hidden rounded-[10px] border border-white/10 bg-black">
              <Image
                src="/landingpagestuff.png"
                alt="Delta laptop screen preview"
                fill
                priority
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
            </div>
          </div>
          {/* Show upper half only and fade the lower half into the page */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%] bg-gradient-to-b from-transparent via-black/65 to-black" />
        </motion.div>

      </div>
    </section>
  );
}
