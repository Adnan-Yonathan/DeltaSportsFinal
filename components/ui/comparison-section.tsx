"use client";

import { Check, X, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface Feature {
  name: string;
  chatgpt: "yes" | "no" | "partial";
  oddsjam: "yes" | "no" | "partial";
  delta: "yes" | "no" | "partial";
}

interface ComparisonSectionProps {
  badge?: string;
  heading?: string;
  description?: string;
  features?: Feature[];
}

const defaultFeatures: Feature[] = [
  {
    name: "AI-Powered Chat Assistant",
    chatgpt: "yes",
    oddsjam: "no",
    delta: "yes",
  },
  {
    name: "Real-Time Odds Comparison",
    chatgpt: "no",
    oddsjam: "yes",
    delta: "yes",
  },
  {
    name: "Sports Betting Knowledge",
    chatgpt: "partial",
    oddsjam: "partial",
    delta: "yes",
  },
  {
    name: "Advanced AI Projection Models",
    chatgpt: "no",
    oddsjam: "no",
    delta: "yes",
  },
  {
    name: "Live Game Projection Models",
    chatgpt: "no",
    oddsjam: "no",
    delta: "yes",
  },
  {
    name: "EV Scanner",
    chatgpt: "no",
    oddsjam: "yes",
    delta: "yes",
  },
  {
    name: "Natural Language Queries",
    chatgpt: "yes",
    oddsjam: "no",
    delta: "yes",
  },
  {
    name: "Parlay Projection Model",
    chatgpt: "no",
    oddsjam: "no",
    delta: "yes",
  },
  {
    name: "All-in-One Platform",
    chatgpt: "no",
    oddsjam: "no",
    delta: "yes",
  },
];

const StatusIcon = ({ status }: { status: "yes" | "no" | "partial" }) => {
  if (status === "yes") {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
        <Check className="w-4 h-4 text-emerald-400" />
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20">
        <Minus className="w-4 h-4 text-yellow-400" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
      <X className="w-4 h-4 text-red-400" />
    </div>
  );
};

const ComparisonSection = ({
  badge = "Compare",
  heading = "Why Choose Delta Sports AI?",
  description = "See how Delta Sports AI stacks up against the competition",
  features = defaultFeatures,
}: ComparisonSectionProps) => {
  const products = [
    { key: "chatgpt", name: "ChatGPT", highlight: false },
    { key: "oddsjam", name: "OddsJam", highlight: false },
    { key: "delta", name: "Delta Sports AI", highlight: true },
  ];

  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center mb-12">
          <h2 className="max-w-2xl text-3xl font-bold text-white md:text-5xl">
            {heading}
          </h2>
          <p className="text-white/70 max-w-xl">
            {description}
          </p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/15 bg-black overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 p-4 md:p-6 border-b border-white/15 bg-black">
              <div className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Features
              </div>
              {products.map((product) => (
                <div
                  key={product.key}
                  className={`text-center ${
                    product.highlight
                      ? "text-white font-bold"
                      : "text-white/80 font-medium"
                  }`}
                >
                  <div className="text-sm md:text-base">{product.name}</div>
                  {product.highlight && (
                    <Badge className="mt-1 bg-white text-[#4E4E4E] text-[10px] border-0">
                      BEST VALUE
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-white/10">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="grid grid-cols-4 gap-4 p-4 md:p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="text-sm text-white/80 flex items-center">
                    {feature.name}
                  </div>
                  <div className="flex justify-center items-center">
                    <StatusIcon status={feature.chatgpt} />
                  </div>
                  <div className="flex justify-center items-center">
                    <StatusIcon status={feature.oddsjam} />
                  </div>
                  <div className="flex justify-center items-center relative">
                    <div className="absolute inset-0 bg-white/5 -mx-4 md:-mx-6" />
                    <div className="relative">
                      <StatusIcon status={feature.delta} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Table Footer */}
            <div className="grid grid-cols-4 gap-4 p-4 md:p-6 border-t border-white/15 bg-black">
              <div className="text-sm font-medium text-white/70">
                Best For
              </div>
              <div className="text-center text-xs md:text-sm text-white/70">
                General AI tasks
              </div>
              <div className="text-center text-xs md:text-sm text-white/70">
                Odds comparison
              </div>
              <div className="text-center text-xs md:text-sm text-white font-medium">
                Complete betting edge
              </div>
            </div>

            {/* Pricing Row */}
            <div className="grid grid-cols-4 gap-4 p-4 md:p-6 border-t border-white/15 bg-black">
              <div className="text-sm font-medium text-white/70">
                Price
              </div>
              <div className="text-center">
                <span className="text-lg md:text-xl font-bold text-white">$20</span>
                <span className="text-xs text-white/70">/mo</span>
              </div>
              <div className="text-center">
                <span className="text-lg md:text-xl font-bold text-white">$199-999</span>
                <span className="text-xs text-white/70">/mo</span>
              </div>
              <div className="text-center relative">
                <div className="absolute inset-0 bg-white/10 -mx-4 md:-mx-6" />
                <div className="relative">
                  <span className="text-lg md:text-xl font-bold text-white">$9</span>
                  <span className="text-xs text-white/70">/mo*</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Note */}
          <p className="text-center text-xs text-white/70 mt-3">
            *Billed annually
          </p>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <StatusIcon status="yes" />
              <span>Full Support</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status="partial" />
              <span>Partial Support</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status="no" />
              <span>Not Available</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { ComparisonSection };
