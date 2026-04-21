"use client"

import { cn } from "@/lib/utils"

export const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur sm:p-6">
    <div aria-hidden className="pointer-events-none absolute inset-0 insider-grid opacity-20" />
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description && <p className="text-sm text-white/60">{description}</p>}
    </div>
    <div className="mt-4">{children}</div>
  </section>
)

export const Field = ({
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  helper?: string
}) => (
  <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.18em] text-white/50 sm:tracking-[0.2em]">
    {label}
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none"
    />
    {helper && <span className="text-[10px] normal-case tracking-normal text-white/40">{helper}</span>}
  </label>
)

export const Output = ({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "good" | "warn"
}) => (
  <div
    className={cn(
      "rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm",
      tone === "good" && "border-emerald-400/40 text-emerald-200",
      tone === "warn" && "border-amber-400/40 text-amber-200"
    )}
  >
    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</div>
    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
  </div>
)
