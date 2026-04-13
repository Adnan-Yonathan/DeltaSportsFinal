"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

const EDGE_PERCENT = 2.62;
const DAYS_PER_MONTH = 30;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface ROICalculatorProps {
  heading?: string;
  description?: string;
  variant?: "default" | "mini" | "welcome";
}

const ROICalculator = ({
  heading = "Calculate Your Edge",
  description = "See how much you could earn following Delta's sharp movement signals",
  variant = "default",
}: ROICalculatorProps) => {
  const [betSize, setBetSize] = useState<string>(variant === "welcome" ? "100" : "100");
  const [betsPerDay, setBetsPerDay] = useState<string>(variant === "welcome" ? "1" : "5");

  const betSizeNum = parseFloat(betSize) || 0;
  const betsPerDayNum = parseFloat(betsPerDay) || 0;

  const perBetReturn = betSizeNum * (EDGE_PERCENT / 100);
  const dailyReturn = perBetReturn * betsPerDayNum;
  const monthlyReturn = dailyReturn * DAYS_PER_MONTH;

  const welcomeRef = useRef<HTMLDivElement | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [displayMonthly, setDisplayMonthly] = useState(0);

  const monthlyTarget = useMemo(() => {
    if (!Number.isFinite(monthlyReturn) || monthlyReturn <= 0) return 0;
    return monthlyReturn;
  }, [monthlyReturn]);

  useEffect(() => {
    if (variant !== "welcome") return;
    if (!welcomeRef.current) return;

    const el = welcomeRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setHasAnimated(true);
      },
      { threshold: 0.35 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [variant]);

  useEffect(() => {
    if (variant !== "welcome") return;
    if (!hasAnimated) return;

    const durationMs = 1100;
    const start = performance.now();
    const from = displayMonthly;
    const to = monthlyTarget;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const v = from + (to - from) * easeOutCubic(t);
      setDisplayMonthly(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, hasAnimated, monthlyTarget]);

  if (variant === "mini") {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-black/95 to-black/90 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-300/70">
            {heading}
          </p>
          <p className="text-xs text-white/60">{description}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-1.5">
              Bet Size
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="w-3.5 h-3.5 text-white/50" />
              </div>
              <input
                type="number"
                value={betSize}
                onChange={(e) => setBetSize(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                placeholder="100"
                min="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-1.5">
              Bets / Day
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calculator className="w-3.5 h-3.5 text-white/50" />
              </div>
              <input
                type="number"
                value={betsPerDay}
                onChange={(e) => setBetsPerDay(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                placeholder="5"
                min="0"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
            Monthly Return
          </div>
          <div className="text-xl font-bold text-emerald-300">
            {formatCurrency(monthlyReturn)}
          </div>
          <div className="mt-1 text-[10px] text-white/50">
            {formatCurrency(betSizeNum)} x {betsPerDayNum} x {DAYS_PER_MONTH} days
          </div>
        </div>
      </div>
    );
  }

  if (variant === "welcome") {
    const isLoaded = hasAnimated;
    const display = isLoaded ? displayMonthly : 0;

    return (
      <section ref={welcomeRef} className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 flex flex-col gap-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
              ROI
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Load your expected edge
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-white/70 sm:text-base">
              Based on a {EDGE_PERCENT.toFixed(2)}% expected value edge. Watch the console
              compute what a disciplined workflow can produce.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-black/65 shadow-[0_24px_90px_rgba(16,185,129,0.14)] backdrop-blur">
            <div className="pointer-events-none absolute inset-0 insider-scanlines opacity-35" />
            <div className="pointer-events-none absolute inset-0 insider-grid opacity-35" />
            <div className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.18),transparent_45%),radial-gradient(circle_at_70%_35%,rgba(56,189,248,0.10),transparent_50%)]" />

            <div className="relative z-10 grid grid-cols-1 gap-6 p-6 md:grid-cols-12 md:p-8">
              <div className="md:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                    Inputs
                  </p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-1.5">
                        Bet Size
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <DollarSign className="w-4 h-4 text-white/50" />
                        </div>
                        <input
                          type="number"
                          value={betSize}
                          onChange={(e) => {
                            setBetSize(e.target.value);
                            setHasAnimated(true);
                          }}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-base font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                          placeholder="100"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-1.5">
                        Bets / Day
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calculator className="w-4 h-4 text-white/50" />
                        </div>
                        <input
                          type="number"
                          value={betsPerDay}
                          onChange={(e) => {
                            setBetsPerDay(e.target.value);
                            setHasAnimated(true);
                          }}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-base font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                          placeholder="1"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/70 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                      Assumptions
                    </p>
                    <div className="mt-2 text-xs text-white/65">
                      Edge: <span className="text-emerald-200">{EDGE_PERCENT.toFixed(2)}%</span>
                      <span className="text-white/40"> - </span>
                      Month: <span className="text-emerald-200">{DAYS_PER_MONTH}</span> days
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7">
                <div className="h-full rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/10 via-black/80 to-black p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
                        Output
                      </p>
                      <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                        Monthly Profit (EV)
                      </h3>
                    </div>
                    <div className="rounded-2xl border border-emerald-300/20 bg-black/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                      {isLoaded ? "computed" : "loading"}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-black/70 p-6 text-center shadow-[0_18px_60px_rgba(16,185,129,0.16)]">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-emerald-200/70">
                      Estimated Monthly Return
                    </div>
                    <div className="mt-3 text-4xl font-bold text-emerald-200 sm:text-5xl">
                      {formatCurrency(display)}
                    </div>
                    <div className="mt-3 text-xs text-white/55">
                      {formatCurrency(betSizeNum)} x {betsPerDayNum} x {DAYS_PER_MONTH} days x {EDGE_PERCENT.toFixed(2)}%
                    </div>

                    <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: `${monthlyTarget <= 0 ? 0 : 100}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-200"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MiniOut label="Per bet" value={formatCurrency(perBetReturn)} />
                    <MiniOut label="Daily EV" value={formatCurrency(dailyReturn)} />
                    <MiniOut label="Monthly EV" value={formatCurrency(monthlyReturn)} accent />
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/60 p-4 text-center">
                    <p className="text-xs text-white/55">
                      Past performance does not guarantee future results. EV depends on execution,
                      discipline, and market conditions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center mb-12">
          <h2 className="max-w-2xl text-3xl font-bold text-white md:text-5xl">
            {heading}
          </h2>
          <p className="text-white/70 max-w-xl">{description}</p>
        </div>

        {/* Calculator Card */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-white/15 bg-black overflow-hidden">
            {/* Inputs */}
            <div className="p-6 space-y-6">
              {/* Bet Size Input */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Your Bet Size
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="w-5 h-5 text-white/50" />
                  </div>
                  <input
                    type="number"
                    value={betSize}
                    onChange={(e) => setBetSize(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 rounded-xl bg-white/5 border border-white/15 text-white text-xl font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                    placeholder="100"
                    min="0"
                  />
                </div>
              </div>

              {/* Bets Per Day Input */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Bets Per Day
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calculator className="w-5 h-5 text-white/50" />
                  </div>
                  <input
                    type="number"
                    value={betsPerDay}
                    onChange={(e) => setBetsPerDay(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 rounded-xl bg-white/5 border border-white/15 text-white text-xl font-semibold focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/50 transition-colors"
                    placeholder="5"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="p-6 bg-white/5 border-t border-white/15">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Per Bet Return */}
                <motion.div
                  key={`per-bet-${perBetReturn}`}
                  initial={{ scale: 0.95, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl border border-white/10 bg-black/50 p-4 text-center"
                >
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                    Per Bet Return
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(perBetReturn)}
                  </div>
                </motion.div>

                {/* Daily Return */}
                <motion.div
                  key={`daily-${dailyReturn}`}
                  initial={{ scale: 0.95, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl border border-white/10 bg-black/50 p-4 text-center"
                >
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                    Daily Return
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(dailyReturn)}
                  </div>
                </motion.div>

                {/* Monthly Return */}
                <motion.div
                  key={`monthly-${monthlyReturn}`}
                  initial={{ scale: 0.95, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center"
                >
                  <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
                    Monthly Return
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(monthlyReturn)}
                  </div>
                </motion.div>
              </div>

              {/* Calculation Breakdown */}
              <div className="mt-4 text-center text-sm text-white/50">
                {formatCurrency(betSizeNum)} x {betsPerDayNum} bets x {DAYS_PER_MONTH} days
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 border-t border-white/10">
              <p className="text-xs text-white/40 text-center">
                Based on historical CLV performance. Past performance does not
                guarantee future results. Results vary based on volume and
                discipline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { ROICalculator };

function MiniOut({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        accent
          ? "border-emerald-400/25 bg-emerald-400/10"
          : "border-white/10 bg-black/55"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
        {label}
      </div>
      <div className={`mt-2 text-xl font-bold ${accent ? "text-emerald-200" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
