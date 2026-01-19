"use client";

import { useState } from "react";
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
}

const ROICalculator = ({
  heading = "Calculate Your Edge",
  description = "See how much you could earn following Delta's sharp projections",
}: ROICalculatorProps) => {
  const [betSize, setBetSize] = useState<string>("100");
  const [betsPerDay, setBetsPerDay] = useState<string>("5");

  const betSizeNum = parseFloat(betSize) || 0;
  const betsPerDayNum = parseFloat(betsPerDay) || 0;

  const perBetReturn = betSizeNum * (EDGE_PERCENT / 100);
  const dailyReturn = perBetReturn * betsPerDayNum;
  const monthlyReturn = dailyReturn * DAYS_PER_MONTH;

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
