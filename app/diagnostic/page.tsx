'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DiagnosticPage() {
  const [status, setStatus] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    diagnose()
  }, [])

  const diagnose = async () => {
    const supabase = createClient()
    const results: any = {}

    // Check environment variables
    results.envVars = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
    }

    // Check auth session
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      results.session = {
        status: session ? '✓ Active' : '✗ No session',
        userId: session?.user?.id || 'N/A',
        error: error?.message || 'None',
      }
    } catch (err: any) {
      results.session = {
        status: '✗ Error',
        error: err.message,
      }
    }

    // Check user
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      results.user = {
        status: user ? '✓ Found' : '✗ Not found',
        userId: user?.id || 'N/A',
        email: user?.email || 'N/A',
        error: error?.message || 'None',
      }
    } catch (err: any) {
      results.user = {
        status: '✗ Error',
        error: err.message,
      }
    }

    setStatus(results)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-accent-cyan">Running diagnostics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-accent-orange mb-8">
          Delta AI - Authentication Diagnostics
        </h1>

        <div className="space-y-6">
          {/* Environment Variables */}
          <div className="card">
            <h2 className="card-header">Environment Variables</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Supabase URL:</span>
                <span className={status.envVars?.supabaseUrl?.includes('✓') ? 'text-success-green' : 'text-warning-red'}>
                  {status.envVars?.supabaseUrl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Supabase Anon Key:</span>
                <span className={status.envVars?.supabaseKey?.includes('✓') ? 'text-success-green' : 'text-warning-red'}>
                  {status.envVars?.supabaseKey}
                </span>
              </div>
            </div>
          </div>

          {/* Session */}
          <div className="card">
            <h2 className="card-header">Auth Session</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Status:</span>
                <span className={status.session?.status?.includes('✓') ? 'text-success-green' : 'text-warning-red'}>
                  {status.session?.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">User ID:</span>
                <span className="text-text-primary font-mono text-sm">{status.session?.userId}</span>
              </div>
              {status.session?.error && status.session.error !== 'None' && (
                <div className="mt-2 p-2 bg-warning-red/20 border border-warning-red rounded text-sm">
                  <strong>Error:</strong> {status.session.error}
                </div>
              )}
            </div>
          </div>

          {/* User */}
          <div className="card">
            <h2 className="card-header">Current User</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Status:</span>
                <span className={status.user?.status?.includes('✓') ? 'text-success-green' : 'text-warning-red'}>
                  {status.user?.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">User ID:</span>
                <span className="text-text-primary font-mono text-sm">{status.user?.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Email:</span>
                <span className="text-text-primary">{status.user?.email}</span>
              </div>
              {status.user?.error && status.user.error !== 'None' && (
                <div className="mt-2 p-2 bg-warning-red/20 border border-warning-red rounded text-sm">
                  <strong>Error:</strong> {status.user.error}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={diagnose} className="btn-primary">
              Refresh Diagnostics
            </button>
            <a href="/auth/login" className="btn-secondary">
              Go to Login
            </a>
            <a href="/chat" className="btn-secondary">
              Go to Chat
            </a>
          </div>

          {/* Instructions */}
          <div className="card bg-accent-cyan/10 border-accent-cyan">
            <h2 className="text-accent-cyan font-bold mb-2">Troubleshooting Steps:</h2>
            <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
              <li>Verify all environment variables are set in <code className="text-accent-cyan">.env.local</code></li>
              <li>Check Supabase project is active and database schema is deployed</li>
              <li>Verify Supabase Auth is enabled in dashboard (Authentication → Settings)</li>
              <li>Check browser console for detailed error messages</li>
              <li>Try signing up with a new account first</li>
              <li>Check Supabase dashboard → Authentication → Users to verify account exists</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
