import { cn } from "@/lib/utils";
import {
  IconBrain,
  IconBolt,
  IconTrendingUp,
  IconChartBar,
  IconTarget,
  IconShield,
  IconCurrencyDollar,
  IconActivity,
} from "@tabler/icons-react";

export function FeaturesSectionWithHoverEffects() {
  const features = [
    {
      title: "AI Assistant",
      description:
        "Chat with advanced AI to analyze games, understand odds movements, and get strategic insights.",
      icon: <IconBrain />,
    },
    {
      title: "Line Shopping",
      description:
        "Compare odds across every major sportsbook in real time to lock in the best price before it moves.",
      icon: <IconCurrencyDollar />,
    },
    {
      title: "Live Score Intelligence",
      description:
        "ESPN-powered lineups, box scores, and player stats stream into the app and update every card in real time.",
      icon: <IconActivity />,
    },
    {
      title: "Bankroll Management",
      description:
        "Track every bet, analyze your performance, and manage your bankroll with advanced analytics.",
      icon: <IconChartBar />,
    },
    {
      title: "Custom Models",
      description:
        "Automatically do research and run prediction models to find bets that match your style.",
      icon: <IconTarget />,
    },
    {
      title: "Secure & Private",
      description:
        "Bank-level encryption with row-level security. Your data is completely private.",
      icon: <IconShield />,
    },
    {
      title: "On-Demand Research",
      description:
        "Ask the copilot for live stats, starters, or matchup context and get instant answers pulled from our ESPN data cache.",
      icon: <IconTrendingUp />,
    },
    {
      title: "Smart Alerts & Automation",
      description:
        "Set custom triggers for injuries, price thresholds, or model confidence and automate notifications everywhere.",
      icon: <IconBolt />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-emerald-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
