'use client'

import { FormEvent, useState } from 'react'

export default function AttributionUnlockForm() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/attribution/unlock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Invalid password')
      }

      window.location.reload()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to unlock page')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-white/10 bg-black/60 p-6 text-white">
      <h1 className="text-xl font-semibold">Attribution Dashboard</h1>
      <p className="mt-2 text-sm text-white/70">Enter the password to view trial attribution analytics.</p>

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm text-white outline-none ring-emerald-400/40 placeholder:text-white/40 focus:ring"
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border border-emerald-300/60 bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
