import { cn } from "@/lib/utils";

/**
 * Modern Glassmorphism Timeline
 * - Vertical timeline with glowing nodes
 * - Glassy cards for content
 * - Delta black/emerald theme
 */

export type TimelineEvent = {
  year: string;
  title: string;
  description: string;
};

type TimelineComponentProps = {
  events?: TimelineEvent[];
  className?: string;
};

const DEFAULT_EVENTS: TimelineEvent[] = [
  {
    year: "2021",
    title: "Founded yourThing",
    description: "The project started with a small passionate team.",
  },
  {
    year: "2022",
    title: "Launch v1.0",
    description: "Released our first public version with core features.",
  },
  {
    year: "2023",
    title: "Global Expansion",
    description: "Scaled to thousands of users in over 40 countries.",
  },
  {
    year: "2024",
    title: "New Horizons",
    description: "Introduced AI-powered features and deeper integrations.",
  },
];

export const Component = ({ events = DEFAULT_EVENTS, className }: TimelineComponentProps) => {
  return (
    <div className={cn("relative mx-auto max-w-3xl px-4 py-12", className)}>
      <div className="absolute left-[18px] top-0 h-full w-[2px] bg-gradient-to-b from-emerald-300/70 via-emerald-400/55 to-emerald-600/45" />

      <div className="space-y-12">
        {events.map((event, idx) => (
          <div key={`${event.year}-${idx}`} className="animate-fade-in relative flex items-start gap-6">
            <div className="relative z-10">
              <div
                className={cn(
                  "h-4 w-4 rounded-full border-2 border-white/80",
                  "bg-gradient-to-r from-emerald-300 to-emerald-500",
                  "shadow-[0_0_14px_rgba(16,185,129,0.65)]",
                  "transition-transform duration-200 hover:scale-110"
                )}
              />
            </div>

            <div
              className={cn(
                "flex-1 rounded-lg p-4 backdrop-blur-xl",
                "bg-black/55",
                "border border-white/10",
                "shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
                "hover:shadow-[0_10px_36px_rgba(16,185,129,0.22)] transition-all duration-300"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                {event.year}
              </span>
              <h3 className="mt-1 text-lg font-semibold text-white">{event.title}</h3>
              <p className="mt-2 text-sm text-white/75">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

