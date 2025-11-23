'use client';

import { BarChart3, TrendingUp, Brain, Zap, Search, Target } from 'lucide-react';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';

interface Feature {
    title: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    description: string;
    steps: string[];
}

const features: Feature[] = [
    {
        title: 'Real-Time Odds Comparison',
        icon: Zap,
        description: 'Compare odds across 10+ sportsbooks instantly. Find the best lines and maximize value on every bet.',
        steps: [
            'Live odds from major sportsbooks',
            'Automatic line movement alerts',
            'Best price identification',
            'Historical line tracking',
        ],
    },
    {
        title: 'Advanced Statistics',
        icon: BarChart3,
        description: 'Access comprehensive stats for every team and player. Deep analytics to inform your betting decisions.',
        steps: [
            'Team & player performance metrics',
            'Head-to-head historical data',
            'Situational statistics',
            'Trend analysis & patterns',
        ],
    },
    {
        title: 'Custom Betting Models',
        icon: Brain,
        description: 'Build personalized models with your own criteria. Generate projections tailored to your strategy.',
        steps: [
            'Define your own parameters',
            'AI-assisted model creation',
            'Backtest against historical data',
            'Export projections & insights',
        ],
    },
    {
        title: 'Live Game Tracking',
        icon: TrendingUp,
        description: 'Real-time scores, stats, and updates. Stay on top of every game as it happens.',
        steps: [
            'Live scores across all sports',
            'In-game statistics updates',
            'Play-by-play tracking',
            'Instant notifications',
        ],
    },
    {
        title: 'AI-Powered Research',
        icon: Search,
        description: 'Get intelligent insights on any matchup. Ask questions in plain English and receive expert-level analysis.',
        steps: [
            'Natural language queries',
            'Injury & news integration',
            'Matchup breakdowns',
            'Key factor identification',
        ],
    },
    {
        title: 'Smart Line Shopping',
        icon: Target,
        description: 'Never miss the best line. Automated comparison finds optimal prices across all books.',
        steps: [
            'Cross-sportsbook comparison',
            'Expected value calculations',
            'Arbitrage detection',
            'Price alerts & notifications',
        ],
    },
];

const Step = ({ title }: { title: string }) => {
    return (
        <li className="flex gap-2 items-start">
            <CheckIcon />
            <p className="text-white">{title}</p>
        </li>
    );
};

const CheckIcon = () => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
                d="M12 2c-.218 0 -.432 .002 -.642 .005l-.616 .017l-.299 .013l-.579 .034l-.553 .046c-4.785 .464 -6.732 2.411 -7.196 7.196l-.046 .553l-.034 .579c-.005 .098 -.01 .198 -.013 .299l-.017 .616l-.004 .318l-.001 .324c0 .218 .002 .432 .005 .642l.017 .616l.013 .299l.034 .579l.046 .553c.464 4.785 2.411 6.732 7.196 7.196l.553 .046l.579 .034c.098 .005 .198 .01 .299 .013l.616 .017l.642 .005l.642 -.005l.616 -.017l.299 -.013l.579 -.034l.553 -.046c4.785 -.464 6.732 -2.411 7.196 -7.196l.046 -.553l.034 -.579c.005 -.098 .01 -.198 .013 -.299l.017 -.616l.005 -.642l-.005 -.642l-.017 -.616l-.013 -.299l-.034 -.579l-.046 -.553c-.464 -4.785 -2.411 -6.732 -7.196 -7.196l-.553 -.046l-.579 -.034a28.058 28.058 0 0 0 -.299 -.013l-.616 -.017l-.318 -.004l-.324 -.001zm2.293 7.293a1 1 0 0 1 1.497 1.32l-.083 .094l-4 4a1 1 0 0 1 -1.32 .083l-.094 -.083l-2 -2a1 1 0 0 1 1.32 -1.497l.094 .083l1.293 1.292l3.293 -3.292z"
                fill="currentColor"
                strokeWidth="0"
            />
        </svg>
    );
};

type AnimatedContainerProps = {
    delay?: number;
    className?: string;
    children: React.ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: AnimatedContainerProps) {
    const shouldReduceMotion = useReducedMotion();

    if (shouldReduceMotion) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
            whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.8 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function HowWeHelpSection() {
    return (
        <section className="py-16 md:py-32 font-[var(--font-sans)]">
            <div className="mx-auto w-full max-w-6xl space-y-12 px-4">
                <AnimatedContainer className="mx-auto max-w-3xl text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                        How We Make Your Life Easier
                    </h2>
                    <p className="text-white/60 mt-4 text-base md:text-lg">
                        Stop wasting time on manual research. Let Delta AI do the heavy lifting.
                    </p>
                </AnimatedContainer>

                <AnimatedContainer
                    delay={0.3}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {features.map((feature, i) => (
                        <CardSpotlight
                            key={i}
                            className="h-full"
                        >
                            <div className="relative z-20">
                                <feature.icon
                                    className="h-6 w-6 text-blue-500"
                                    strokeWidth={1.5}
                                />
                                <p className="text-xl font-bold mt-4 text-white">
                                    {feature.title}
                                </p>
                                <p className="text-neutral-300 mt-2 text-sm">
                                    {feature.description}
                                </p>
                                <ul className="list-none mt-4 space-y-1">
                                    {feature.steps.map((step, stepIndex) => (
                                        <Step key={stepIndex} title={step} />
                                    ))}
                                </ul>
                            </div>
                        </CardSpotlight>
                    ))}
                </AnimatedContainer>
            </div>
        </section>
    );
}
