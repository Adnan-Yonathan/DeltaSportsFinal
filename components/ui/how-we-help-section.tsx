'use client';

import { Zap, Brain, TrendingUp, Search, BarChart3, Clock } from 'lucide-react';
import { FeatureCard, AnimatedContainer, type FeatureType } from '@/components/ui/grid-feature-cards';

const features: FeatureType[] = [
    {
        title: 'Instant Odds Comparison',
        icon: Zap,
        description: 'Compare odds across 10+ sportsbooks in seconds. Never miss the best line again.',
    },
    {
        title: 'AI-Powered Analysis',
        icon: Brain,
        description: 'Get intelligent insights on any game. Ask questions in plain English and get expert-level answers.',
    },
    {
        title: 'Live Statistics',
        icon: TrendingUp,
        description: 'Real-time player props, team stats, and game data updated every second. Always have the latest numbers.',
    },
    {
        title: 'Smart Research',
        icon: Search,
        description: 'Deep dive into matchups with AI-generated reports. Injuries, trends, and key stats at your fingertips.',
    },
    {
        title: 'Line Shopping',
        icon: BarChart3,
        description: 'Compare lines across every major sportsbook instantly. Find the best price and maximize your expected value on every bet.',
    },
    {
        title: 'Custom Projections',
        icon: Clock,
        description: 'Build personalized models with your own criteria. Generate projections tailored to your betting strategy in minutes.',
    },
];

export function HowWeHelpSection() {
    return (
        <section className="py-16 md:py-32 font-[var(--font-sans)]">
            <div className="mx-auto w-full max-w-5xl space-y-8 px-4">
                <AnimatedContainer className="mx-auto max-w-3xl text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                        How We Make Your Life Easier
                    </h2>
                    <p className="text-white/60 mt-4 text-base md:text-lg">
                        Stop wasting time on manual research. Let Delta AI do the heavy lifting.
                    </p>
                </AnimatedContainer>

                <AnimatedContainer
                    delay={0.4}
                    className="grid grid-cols-1 divide-x divide-y divide-dashed divide-white/10 border border-dashed border-white/10 sm:grid-cols-2 md:grid-cols-3"
                >
                    {features.map((feature, i) => (
                        <FeatureCard key={i} feature={feature} />
                    ))}
                </AnimatedContainer>
            </div>
        </section>
    );
}
