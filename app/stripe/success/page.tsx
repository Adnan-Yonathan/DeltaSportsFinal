'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMembershipStatus } from '@/lib/utils/membership'

export default function StripeSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'success' | 'timeout'>('checking')
  const [attempts, setAttempts] = useState(0)
  const maxAttempts = 15 // 15 attempts * 2 seconds = 30 seconds max

  useEffect(() => {
    const checkSubscription = async () => {
      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in, redirect to login
        router.push('/auth/login')
        return
      }

      // Check membership status from user metadata
      const membership = getMembershipStatus(user.user_metadata)

      if (membership.isActive) {
        setStatus('success')
        // Wait a moment to show success, then redirect
        setTimeout(() => {
          router.push('/chat')
        }, 1500)
        return
      }

      // If not active yet, increment attempts
      setAttempts(prev => prev + 1)
    }

    // Initial check
    if (status === 'checking') {
      checkSubscription()
    }

    // Set up polling
    if (status === 'checking' && attempts < maxAttempts) {
      const timer = setTimeout(async () => {
        const supabase = createClient()

        // Refresh the session to get updated user metadata
        await supabase.auth.refreshSession()

        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const membership = getMembershipStatus(user.user_metadata)

          if (membership.isActive) {
            setStatus('success')
            setTimeout(() => {
              router.push('/chat')
            }, 1500)
            return
          }
        }

        setAttempts(prev => prev + 1)
      }, 2000)

      return () => clearTimeout(timer)
    }

    // Timeout after max attempts
    if (attempts >= maxAttempts && status === 'checking') {
      setStatus('timeout')
    }
  }, [attempts, status, router, maxAttempts])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Setting up your account...
            </h1>
            <p className="text-white/60">
              This usually takes just a few seconds.
            </p>
            <div className="mt-4 text-sm text-white/40">
              {attempts > 5 && "Still working on it..."}
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">
              You're all set!
            </h1>
            <p className="text-white/60">
              Redirecting you to the chat...
            </p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Taking longer than expected
            </h1>
            <p className="text-white/60 mb-6">
              Your payment was successful, but we're still setting up your account.
              This can sometimes take a minute.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAttempts(0)
                  setStatus('checking')
                }}
                className="w-full py-3 px-4 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
              >
                Check Again
              </button>
              <button
                onClick={() => router.push('/chat')}
                className="w-full py-3 px-4 rounded-lg bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
              >
                Go to Chat Anyway
              </button>
            </div>
            <p className="text-white/40 text-sm mt-4">
              If you continue to have issues, please contact support.
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}
