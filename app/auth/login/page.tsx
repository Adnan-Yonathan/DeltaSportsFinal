'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        router.push('/chat')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-accent-orange mb-2">DELTA AI</h1>
          <p className="text-text-secondary">
            Intelligent Sports Betting Assistant
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-bg-secondary border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Sign In</h2>

          {error && (
            <div className="bg-warning-red/20 border border-warning-red text-warning-red p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-secondary text-sm">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-accent-cyan hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 text-center text-xs text-text-secondary">
          <p className="mb-2">
            ⚠️ Delta AI is a tool for sports betting analysis and education.
          </p>
          <p className="mb-2">All betting involves risk. Never bet more than you can afford to lose.</p>
          <p>Gambling problem? Call 1-800-GAMBLER</p>
        </div>
      </div>
    </div>
  )
}
