"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Activity, LineChart, Radar, Target } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { LineMovementIntroChart } from "@/components/ui/line-movement-intro-chart";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  /* Prevent SSR flash of post-scroll layers before GSAP initializes */
  .main-card,
  .cta-wrapper {
    visibility: hidden;
  }

  /* Prevent first-paint static headline before intro animation starts */
  .text-track,
  .text-days,
  .intro-ctas,
  .intro-chart {
    visibility: hidden;
    opacity: 0;
  }

  .film-grain {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 40;
    opacity: 0.04;
    mix-blend-mode: overlay;
    background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-theme {
    background-size: 60px 60px;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 72%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 72%);
  }

  .text-3d-matte {
    color: #ffffff;
    text-shadow: 0 14px 44px rgba(60, 203, 151, 0.32), 0 2px 4px rgba(255, 255, 255, 0.2);
  }

  .text-silver-matte {
    background: linear-gradient(180deg, #ffffff 0%, #90f7cb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter: drop-shadow(0px 10px 24px rgba(60, 203, 151, 0.25));
  }

  .text-card-silver-matte {
    background: linear-gradient(180deg, #ffffff 0%, #8eecc4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter: drop-shadow(0px 8px 18px rgba(0, 0, 0, 0.7));
  }

  .premium-depth-card {
    background: linear-gradient(150deg, #07171e 0%, #050911 56%, #020203 100%);
    box-shadow:
      0 46px 110px -18px rgba(0, 0, 0, 0.85),
      0 20px 36px -16px rgba(0, 0, 0, 0.82),
      inset 0 1px 1px rgba(255, 255, 255, 0.18),
      inset 0 -2px 5px rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
  }

  .card-sheen {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 30;
    background: radial-gradient(700px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(60, 203, 151, 0.16) 0%, transparent 44%);
    mix-blend-mode: screen;
    transition: opacity 0.25s ease;
  }

  .floating-ui-badge {
    background: linear-gradient(135deg, rgba(20, 28, 36, 0.86) 0%, rgba(7, 12, 18, 0.72) 100%);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 0 0 1px rgba(60, 203, 151, 0.22),
      0 24px 46px -12px rgba(0, 0, 0, 0.82),
      inset 0 1px 1px rgba(255, 255, 255, 0.14),
      inset 0 -1px 1px rgba(0, 0, 0, 0.52);
  }

  .btn-modern-light,
  .btn-modern-dark {
    transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
  }

  .btn-modern-light {
    background: linear-gradient(180deg, #48d9a4 0%, #2eb886 100%);
    color: #062517;
    box-shadow:
      0 0 0 1px rgba(20, 55, 40, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.18),
      0 14px 26px -4px rgba(20, 76, 54, 0.38),
      inset 0 1px 1px rgba(255, 255, 255, 0.72),
      inset 0 -2px 4px rgba(0, 0, 0, 0.12);
  }

  .btn-modern-light:hover {
    transform: translateY(-2px);
  }

  .btn-modern-dark {
    background: linear-gradient(180deg, #1d242a 0%, #0f1217 100%);
    color: #ffffff;
    box-shadow:
      0 0 0 1px rgba(60, 203, 151, 0.24),
      0 2px 4px rgba(0, 0, 0, 0.7),
      0 12px 24px -4px rgba(0, 0, 0, 0.9),
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      inset 0 -3px 6px rgba(0, 0, 0, 0.85);
  }

  .btn-modern-dark:hover {
    transform: translateY(-2px);
    background: linear-gradient(180deg, #2b333a 0%, #151a20 100%);
  }

  .progress-ring {
    transform: rotate(-90deg);
    transform-origin: center;
    stroke-dasharray: 402;
    stroke-dashoffset: 402;
    stroke-linecap: round;
  }

  .iphone-bezel {
    background-color: #111;
    box-shadow:
      inset 0 0 0 2px #3f3f46,
      inset 0 0 0 7px #000,
      0 36px 80px -14px rgba(0, 0, 0, 0.84),
      0 14px 26px -8px rgba(0, 0, 0, 0.7);
    transform-style: preserve-3d;
  }

  .hardware-btn {
    background: linear-gradient(90deg, #404040 0%, #171717 100%);
    box-shadow:
      -2px 0 5px rgba(0, 0, 0, 0.8),
      inset -1px 0 1px rgba(255, 255, 255, 0.15),
      inset 1px 0 2px rgba(0, 0, 0, 0.8);
  }

  .screen-glare {
    background: linear-gradient(110deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0) 45%);
  }

  .laptop-shell {
    width: min(100%, 760px);
    transform-style: preserve-3d;
    filter: drop-shadow(0 28px 62px rgba(0, 0, 0, 0.78));
  }

  .laptop-lid {
    position: relative;
    aspect-ratio: 16 / 10;
    border-radius: 18px;
    padding: 10px;
    background: linear-gradient(180deg, #3a4452 0%, #1f252f 34%, #0f1218 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.28), inset 0 -2px 4px rgba(0, 0, 0, 0.6);
  }

  .laptop-camera {
    position: absolute;
    left: 50%;
    top: 6px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 999px;
    background: #0b0f17;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 8px rgba(0, 0, 0, 0.8);
    z-index: 2;
  }

  .laptop-screen {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    position: relative;
    background: #05070b;
  }

  .laptop-base {
    position: relative;
    margin: 0 auto;
    margin-top: -2px;
    width: 112%;
    max-width: 860px;
    height: 20px;
    border-radius: 0 0 20px 20px;
    background: linear-gradient(180deg, #394452 0%, #1b222e 40%, #111820 100%);
    box-shadow: 0 16px 26px rgba(0, 0, 0, 0.62), inset 0 1px 1px rgba(255, 255, 255, 0.22);
  }

  .laptop-trackpad {
    position: absolute;
    left: 50%;
    top: 3px;
    width: 90px;
    height: 8px;
    margin-left: -45px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
  }

  .perf-lite .floating-ui-badge {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .perf-lite .text-silver-matte,
  .perf-lite .text-card-silver-matte,
  .perf-lite .laptop-shell {
    filter: none;
  }

  .perf-lite .card-sheen {
    opacity: 0.45;
  }
`;

export interface CinematicLandingHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
}

function PhoneMockup({
  metricValue,
  metricLabel,
  counterRef,
  deviceRef,
}: {
  metricValue: number;
  metricLabel: string;
  counterRef: React.RefObject<HTMLSpanElement>;
  deviceRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="device-scroll-wrapper relative w-full h-[420px] sm:h-[520px] flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
      <div className="relative w-full h-full flex items-center justify-center scale-[0.66] sm:scale-[0.86]">
        <div
          ref={deviceRef}
          className="device-mockup relative w-[280px] h-[580px] rounded-[3rem] iphone-bezel flex flex-col will-change-transform"
        >
          <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md" aria-hidden="true" />
          <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
          <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
          <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md scale-x-[-1]" aria-hidden="true" />

          <div className="absolute inset-[7px] bg-[#050914] rounded-[2.5rem] overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,1)] text-white z-10">
            <div className="absolute inset-0 screen-glare z-40 pointer-events-none" aria-hidden="true" />
            <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            </div>

            <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col">
              <div className="data-chip flex justify-between items-center mb-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-emerald-200/70 uppercase tracking-widest font-bold mb-1">Live board</span>
                  <span className="text-xl font-bold tracking-tight text-white">Delta Signals</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-200 flex items-center justify-center font-bold text-sm border border-white/10">
                  DS
                </div>
              </div>

              <div className="data-chip relative w-44 h-44 mx-auto flex items-center justify-center mb-8 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                  <circle cx="88" cy="88" r="64" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle className="progress-ring" cx="88" cy="88" r="64" fill="none" stroke="#3CCB97" strokeWidth="12" />
                </svg>
                <div className="text-center z-10 flex flex-col items-center">
                  <span ref={counterRef} className="counter-val text-4xl font-extrabold tracking-tighter text-white">
                    {metricValue}
                  </span>
                  <span className="text-[8px] text-emerald-200/50 uppercase tracking-[0.1em] font-bold mt-0.5">{metricLabel}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="data-chip rounded-2xl p-3 flex items-center border border-emerald-400/20 bg-emerald-500/5">
                  <Activity className="w-4 h-4 text-emerald-300 mr-3" />
                  <div className="flex-1">
                    <div className="h-2 w-20 bg-neutral-300 rounded-full mb-2" />
                    <div className="h-1.5 w-12 bg-neutral-600 rounded-full" />
                  </div>
                </div>
                <div className="data-chip rounded-2xl p-3 flex items-center border border-emerald-400/20 bg-emerald-500/5">
                  <Target className="w-4 h-4 text-emerald-300 mr-3" />
                  <div className="flex-1">
                    <div className="h-2 w-16 bg-neutral-300 rounded-full mb-2" />
                    <div className="h-1.5 w-24 bg-neutral-600 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full" />
            </div>
          </div>
        </div>

        <div className="floating-badge absolute flex top-8 left-[-12px] floating-ui-badge rounded-xl p-3 items-center gap-2 z-20">
          <LineChart className="w-4 h-4 text-emerald-300" />
          <div>
            <p className="text-white text-xs font-semibold">Edge +3.9%</p>
            <p className="text-emerald-200/60 text-[10px]">Avg flagged value</p>
          </div>
        </div>
        <div className="floating-badge absolute flex bottom-16 right-[-12px] floating-ui-badge rounded-xl p-3 items-center gap-2 z-20">
          <Radar className="w-4 h-4 text-emerald-300" />
          <div>
            <p className="text-white text-xs font-semibold">Whale flow</p>
            <p className="text-emerald-200/60 text-[10px]">Signal detected</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaptopMockup({
  deviceRef,
}: {
  deviceRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="device-scroll-wrapper relative w-full h-[500px] lg:h-[560px] flex items-center justify-center z-10" style={{ perspective: "1200px" }}>
      <div ref={deviceRef} className="device-mockup laptop-shell will-change-transform">
        <div className="laptop-lid">
          <div className="laptop-camera" aria-hidden="true" />
          <div className="laptop-screen">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-transparent to-transparent pointer-events-none" />
            <Image
              src="/landingpagestuff.png"
              alt="Delta Sports dashboard preview"
              fill
              sizes="(min-width: 1280px) 760px, (min-width: 1024px) 70vw, 100vw"
              className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/55" />
          </div>
        </div>
        <div className="laptop-base">
          <div className="laptop-trackpad" aria-hidden="true" />
        </div>
      </div>

      <div className="floating-badge absolute top-9 left-3 lg:left-10 floating-ui-badge rounded-2xl px-4 py-3 flex items-center gap-3">
        <Target className="w-4 h-4 text-emerald-300" />
        <div>
          <p className="text-white text-xs font-semibold">Best Line Found</p>
          <p className="text-emerald-200/65 text-[10px]">+9 cents vs market</p>
        </div>
      </div>

      <div className="floating-badge absolute bottom-8 right-3 lg:right-10 floating-ui-badge rounded-2xl px-4 py-3 flex items-center gap-3">
        <Radar className="w-4 h-4 text-emerald-300" />
        <div>
          <p className="text-white text-xs font-semibold">Whale Alert</p>
          <p className="text-emerald-200/65 text-[10px]">6-figure orderbook wall</p>
        </div>
      </div>
    </div>
  );
}

export function CinematicLandingHero({
  brandName = "Delta Sports",
  tagline1 = "Sports betting intel",
  tagline2 = "made simple.",
  cardHeading = "Proprietary market intelligence all in one platform.",
  cardDescription = (
    <>
      <span className="text-white font-semibold">Delta Sports</span> gives you sharp money signals,
      whale tracking, and betting analytics in one place.
    </>
  ),
  metricValue = 312,
  metricLabel = "Live Signals (24h)",
  ctaHeading = "Track the market in real time.",
  ctaDescription = "Pick your sport. Follow market signals. That's it.",
  className,
  ...props
}: CinematicLandingHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isLowPerf, setIsLowPerf] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setIsDesktop(desktopQuery.matches);
      setShouldAnimate(!reduceMotionQuery.matches);
      const nav = navigator as Navigator & { deviceMemory?: number };
      const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
      const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
      const lowPowerSignals = !desktopQuery.matches || memory <= 4 || cores <= 4;
      setIsLowPerf(lowPowerSignals);
    };

    update();
    desktopQuery.addEventListener("change", update);
    reduceMotionQuery.addEventListener("change", update);
    return () => {
      desktopQuery.removeEventListener("change", update);
      reduceMotionQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !shouldAnimate || isLowPerf || !mainCardRef.current || !deviceRef.current) return;

    const rotateYTo = gsap.quickTo(deviceRef.current, "rotationY", { duration: 0.45, ease: "power2.out" });
    const rotateXTo = gsap.quickTo(deviceRef.current, "rotationX", { duration: 0.45, ease: "power2.out" });

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainCardRef.current) return;
      if (window.scrollY > window.innerHeight * 1.3) return;
      const rect = mainCardRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      mainCardRef.current.style.setProperty("--mouse-x", `${mouseX}px`);
      mainCardRef.current.style.setProperty("--mouse-y", `${mouseY}px`);

      const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
      const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
      rotateYTo(xVal * 7);
      rotateXTo(-yVal * 6);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDesktop, shouldAnimate, isLowPerf]);

  useLayoutEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    const showIntroChart = !isLowPerf;
    const scrollDistance = isLowPerf
      ? Math.round(window.innerHeight * 1.05)
      : isDesktop
        ? Math.round(window.innerHeight * 1.35)
        : Math.round(window.innerHeight * 1.15);

    const ctx = gsap.context(() => {
      gsap.set(".text-track", { autoAlpha: 0, y: 26, scale: 0.96 });
      gsap.set(".text-days", { autoAlpha: 0, y: 16, scale: 0.98 });
      gsap.set(".intro-ctas", { autoAlpha: 0, y: 18, scale: 0.97 });
      if (showIntroChart) {
        gsap.set(".intro-chart", { autoAlpha: 0, y: 22, scale: 0.98 });
      }
      gsap.set(".main-card", { y: window.innerHeight + 160, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".device-scroll-wrapper", ".floating-badge", ".data-chip"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.92, pointerEvents: "none" });

      const introTl = gsap.timeline({ delay: 0 });
      introTl
        .to(".text-track", { duration: 0.7, autoAlpha: 1, y: 0, scale: 1, ease: "power3.out" })
        .to(".text-days", { duration: 0.62, autoAlpha: 1, y: 0, scale: 1, ease: "power3.out" }, "-=0.35")
        .to(".intro-ctas", { duration: 0.56, autoAlpha: 1, y: 0, scale: 1, ease: "power3.out" }, "-=0.22");
      if (showIntroChart) {
        introTl.to(".intro-chart", { duration: 0.62, autoAlpha: 1, y: 0, scale: 1, ease: "power3.out" }, "-=0.2");
      }

      const counterObj = { value: 0 };
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${scrollDistance}`,
          pin: !isLowPerf,
          scrub: isLowPerf ? 0.2 : 0.35,
          anticipatePin: 0.5,
        },
      });

      scrollTl
        .to([".hero-text-wrapper", ".bg-grid-theme"], { scale: 1.05, opacity: isLowPerf ? 0.35 : 0.24, ease: "power2.inOut", duration: 1.1 }, 0)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 1.2 }, 0)
        .fromTo(
          ".device-scroll-wrapper",
          { y: 120, rotationX: isDesktop ? 14 : 10, rotationY: isDesktop ? -10 : 0, autoAlpha: 0, scale: 0.9 },
          { y: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "power3.out", duration: 1.0 },
          "-=0.35"
        )
        .fromTo(".data-chip", { y: 20, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.08, ease: "power3.out", duration: 0.8 }, "-=0.7")
        .to(".progress-ring", { strokeDashoffset: 80, duration: 0.9, ease: "power2.inOut" }, "-=0.75")
        .to(
          counterObj,
          {
            value: metricValue,
            duration: 1.0,
            ease: "power2.out",
            onUpdate: () => {
              if (counterRef.current) {
                counterRef.current.textContent = `${Math.round(counterObj.value)}`;
              }
            },
          },
          "-=0.95"
        )
        .fromTo(".floating-badge", { y: 34, autoAlpha: 0, scale: 0.9 }, { y: 0, autoAlpha: 1, scale: 1, ease: "power3.out", duration: 0.8, stagger: 0.12 }, "-=0.75")
        .fromTo(".card-left-text", { x: -26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power3.out", duration: 0.8 }, "-=0.65")
        .fromTo(".card-right-text", { x: 26, autoAlpha: 0, scale: 0.95 }, { x: 0, autoAlpha: 1, scale: 1, ease: "power3.out", duration: 0.8 }, "<")
        .to({}, { duration: isLowPerf ? 0.45 : 0.8 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .to(".cta-wrapper", { autoAlpha: 1, scale: 1, pointerEvents: "auto", ease: "power2.out", duration: 0.7 })
        .to({}, { duration: isLowPerf ? 0.35 : 0.6 })
        .to([".device-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"], {
          scale: 0.94,
          y: -18,
          autoAlpha: 0,
          ease: "power2.in",
          duration: 0.65,
          stagger: 0.04,
        })
        .to(".main-card", { scale: 0.97, ease: "power2.out", duration: 0.5 }, "pullback")
        .to(".cta-wrapper", { scale: 1, pointerEvents: "auto", ease: "power2.out", duration: 0.5 }, "pullback")
        .to(".main-card", { y: -window.innerHeight - (isLowPerf ? 120 : 180), ease: "power2.in", duration: 0.75 });
    }, containerRef);

    return () => ctx.revert();
  }, [isDesktop, metricValue, shouldAnimate, isLowPerf]);

  return (
    <section
      ref={containerRef}
      className={cn(
        "relative h-screen w-screen overflow-hidden flex items-center justify-center bg-black text-foreground antialiased",
        isLowPerf && "perf-lite",
        className
      )}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      {!isLowPerf ? <div className="film-grain" aria-hidden="true" /> : null}
      <div className={cn("bg-grid-theme absolute inset-0 z-0 pointer-events-none", isLowPerf ? "opacity-25" : "opacity-50")} aria-hidden="true" />

      {shouldAnimate ? (
        <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform -translate-y-8 md:-translate-y-12">
          <h1 className="text-track text-3d-matte font-sans text-4xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2">
            {tagline1}
          </h1>
          <h1 className="text-days text-silver-matte font-sans text-4xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">
            {tagline2}
          </h1>
          <div className="intro-ctas mt-6 mb-5 flex w-full max-w-xl flex-col gap-3 px-2 sm:flex-row sm:gap-4">
            <a
              href="#features"
              className="flex-1 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:border-emerald-300/50 hover:bg-emerald-500/10 hover:text-emerald-100"
            >
              Features
            </a>
            <a
              href="/auth/signup"
              className="flex-1 rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-400/25"
            >
              Get Instant Access
            </a>
          </div>
          {!isLowPerf ? <LineMovementIntroChart /> : null}
        </div>
      ) : null}

      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform pointer-events-auto">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-silver-matte">{ctaHeading}</h2>
        <p className="text-white/75 text-base md:text-xl mb-10 max-w-2xl mx-auto font-light leading-relaxed">{ctaDescription}</p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <a href="/auth/signup" className="btn-modern-light flex items-center justify-center gap-3 px-8 py-4 rounded-[1.1rem] font-semibold">
            Get Instant Access
          </a>
          <a href="#features" className="btn-modern-dark flex items-center justify-center gap-3 px-8 py-4 rounded-[1.1rem] font-semibold">
            View Live Signals
          </a>
        </div>
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative overflow-hidden flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />
          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            <div className="card-right-text order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-5xl md:text-[5rem] lg:text-[7rem] font-black uppercase tracking-tighter text-card-silver-matte">
                {brandName}
              </h2>
            </div>

            <div className="order-2 lg:order-2 relative w-full flex items-center justify-center z-10">
              {isDesktop ? (
                <LaptopMockup deviceRef={deviceRef} />
              ) : (
                <PhoneMockup metricValue={metricValue} metricLabel={metricLabel} counterRef={counterRef} deviceRef={deviceRef} />
              )}
            </div>

            <div className="card-left-text order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full lg:max-w-none px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-1 lg:mb-5 tracking-tight">{cardHeading}</h3>
              <p className="hidden md:block text-emerald-100/65 text-sm md:text-base lg:text-lg font-normal leading-relaxed mx-auto lg:mx-0 max-w-md lg:max-w-none">
                {cardDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
