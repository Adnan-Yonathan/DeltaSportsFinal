 "use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

export default function SportSelector({
  options,
  currentSport,
}: {
  options: SportOption[]
  currentSport: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = useMemo(() => {
    return options.find((option) => option.key === currentSport) ?? options[0]
  }, [options, currentSport])

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    const params = new URLSearchParams(searchParams.toString())
    params.set("sport", next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
        Sport
      </span>
      <select
        value={current?.key}
        onChange={handleChange}
        className="rounded-md border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
      >
        {options.map((option) => (
          <option
            key={option.key}
            value={option.key}
            disabled={option.locked}
          >
            {option.label}
          </option>
        ))}
      </select>
      {current?.locked && (
        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
          Locked
        </span>
      )}
    </div>
  )
}
