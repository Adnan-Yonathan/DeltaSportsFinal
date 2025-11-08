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
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNeedsConfirmation(false)
    setResendSuccess(false)
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
      const errorMessage = err.message || 'Failed to sign in'
      setError(errorMessage)

      // Check if the error is about email not being confirmed
      if (errorMessage.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setLoading(true)
    setResendSuccess(false)
    setError('')

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) throw error

      setResendSuccess(true)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email')
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

          {resendSuccess && (
            <div className="bg-accent-cyan/20 border border-accent-cyan text-accent-cyan p-3 rounded-lg text-sm mb-4">
              <p className="font-semibold">Confirmation email sent!</p>
              <p className="mt-1">Check your email at <strong>{email}</strong> and click the confirmation link.</p>
            </div>
          )}

          {error && needsConfirmation && (
            <div className="bg-warning-red/20 border border-warning-red text-warning-red p-3 rounded-lg text-sm mb-4">
              <p className="font-semibold mb-2">{error}</p>
              <p className="mb-3">Please check your email and click the confirmation link we sent you.</p>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={loading}
                className="text-accent-cyan hover:underline text-sm font-semibold"
              >
                {loading ? 'Sending...' : 'Resend confirmation email'}
              </button>
            </div>
          )}

          {error && !needsConfirmation && (
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
