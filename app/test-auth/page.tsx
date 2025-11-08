'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestAuthPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    const results: any = {}

    try {
      // Check environment variables
      results.envCheck = {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL,
        urlFormat: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co') ? 'Valid' : 'Invalid',
      }

      // Test Supabase client creation
      try {
        const supabase = createClient()
        results.clientCreation = 'Success'

        // Test a simple query
        const { data, error } = await supabase.auth.getSession()
        results.sessionCheck = {
          success: !error,
          error: error?.message || 'None',
          hasSession: !!data.session,
        }

        // Test signup with fake data to see the actual error
        const testEmail = `test-${Date.now()}@example.com`
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: testEmail,
          password: 'test123456',
        })

        results.signupTest = {
          success: !signupError,
          error: signupError?.message || 'None',
          errorDetails: signupError ? JSON.stringify(signupError, null, 2) : 'None',
          userId: signupData?.user?.id || 'None',
        }
      } catch (err: any) {
        results.clientCreation = `Failed: ${err.message}`
      }
    } catch (err: any) {
      results.error = err.message
    }

    setResult(results)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-accent-orange mb-8">
          Supabase Authentication Test
        </h1>

        <button
          onClick={testConnection}
          disabled={loading}
          className="btn-primary mb-6"
        >
          {loading ? 'Testing...' : 'Run Authentication Test'}
        </button>

        {result && (
          <div className="space-y-4">
            {/* Environment Variables */}
            <div className="card">
              <h2 className="card-header">Environment Variables</h2>
              <div className="mt-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span>NEXT_PUBLIC_SUPABASE_URL:</span>
                  <span className={result.envCheck?.hasUrl ? 'text-success-green' : 'text-warning-red'}>
                    {result.envCheck?.hasUrl ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
                  <span className={result.envCheck?.hasKey ? 'text-success-green' : 'text-warning-red'}>
                    {result.envCheck?.hasKey ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
                {result.envCheck?.urlValue && (
                  <div className="mt-2 p-2 bg-bg-primary rounded">
                    <div className="text-text-secondary text-xs mb-1">URL Value:</div>
                    <div className="text-accent-cyan break-all">{result.envCheck.urlValue}</div>
                    <div className={`text-xs mt-1 ${result.envCheck.urlFormat === 'Valid' ? 'text-success-green' : 'text-warning-red'}`}>
                      Format: {result.envCheck.urlFormat}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Client Creation */}
            <div className="card">
              <h2 className="card-header">Supabase Client</h2>
              <div className="mt-4">
                <div className={result.clientCreation === 'Success' ? 'text-success-green' : 'text-warning-red'}>
                  {result.clientCreation}
                </div>
              </div>
            </div>

            {/* Session Check */}
            {result.sessionCheck && (
              <div className="card">
                <h2 className="card-header">Session Check</h2>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Success:</span>
                    <span className={result.sessionCheck.success ? 'text-success-green' : 'text-warning-red'}>
                      {result.sessionCheck.success ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error:</span>
                    <span className="text-text-secondary">{result.sessionCheck.error}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Signup Test */}
            {result.signupTest && (
              <div className="card">
                <h2 className="card-header">Signup Test (This shows the actual error)</h2>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Success:</span>
                    <span className={result.signupTest.success ? 'text-success-green' : 'text-warning-red'}>
                      {result.signupTest.success ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  {!result.signupTest.success && (
                    <div className="mt-2 p-3 bg-warning-red/20 border border-warning-red rounded">
                      <div className="font-bold text-warning-red mb-2">Error Message:</div>
                      <div className="text-sm">{result.signupTest.error}</div>

                      <div className="font-bold text-warning-red mt-4 mb-2">Full Error Details:</div>
                      <pre className="text-xs overflow-auto p-2 bg-bg-primary rounded">
                        {result.signupTest.errorDetails}
                      </pre>
                    </div>
                  )}
                  {result.signupTest.success && (
                    <div className="text-success-green">
                      User created: {result.signupTest.userId}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="card mt-6 bg-accent-cyan/10 border-accent-cyan">
          <h2 className="text-accent-cyan font-bold mb-3">Expected Issues for 400 Error:</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
            <li>
              <strong className="text-text-primary">Wrong Supabase URL format</strong>
              <div className="ml-6 mt-1">Should be: <code className="text-accent-orange">https://xxxxx.supabase.co</code></div>
            </li>
            <li>
              <strong className="text-text-primary">Invalid API key</strong>
              <div className="ml-6 mt-1">Get from: Supabase Dashboard → Settings → API</div>
            </li>
            <li>
              <strong className="text-text-primary">Auth not enabled in Supabase</strong>
              <div className="ml-6 mt-1">Enable: Supabase Dashboard → Authentication → Providers → Email</div>
            </li>
            <li>
              <strong className="text-text-primary">Wrong Supabase project</strong>
              <div className="ml-6 mt-1">Verify you're using the correct project URL</div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}
