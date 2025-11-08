'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [startingBankroll, setStartingBankroll] = useState('1000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Sign up user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Update user profile
        await supabase.from('users').update({
          display_name: displayName || null,
          starting_bankroll: parseFloat(startingBankroll),
          current_bankroll: parseFloat(startingBankroll),
        }).eq('id', data.user.id)

        router.push('/chat')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
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

        {/* Sign Up Form */}
        <div className="bg-bg-secondary border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Create Account</h2>

          {error && (
            <div className="bg-warning-red/20 border border-warning-red text-warning-red p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
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
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Starting Bankroll ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={startingBankroll}
                onChange={(e) => setStartingBankroll(e.target.value)}
                className="input-field"
                placeholder="1000.00"
                required
              />
              <p className="text-xs text-text-secondary mt-1">
                This helps track your performance over time
              </p>
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
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-secondary text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-accent-cyan hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 text-center text-xs text-text-secondary">
          <p className="mb-2">
            By creating an account, you confirm you are 21+ years old.
          </p>
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
