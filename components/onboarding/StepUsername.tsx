"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, X, Loader2 } from "lucide-react"

interface StepUsernameProps {
  value: string
  onChange: (value: string) => void
  onValidation: (isValid: boolean) => void
}

export function StepUsername({ value, onChange, onValidation }: StepUsernameProps) {
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const checkUsername = async () => {
      // Reset states
      setError("")
      setAvailable(null)

      // Validate format first
      if (!value) {
        onValidation(false)
        return
      }

      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
      if (!usernameRegex.test(value)) {
        setError("Username must be 3-20 characters and contain only letters, numbers, and underscores")
        onValidation(false)
        return
      }

      // Check availability with API
      setChecking(true)
      try {
        const response = await fetch(`/api/username/check?username=${encodeURIComponent(value)}`)
        const data = await response.json()

        if (data.error && !data.available) {
          setError(data.error)
          setAvailable(false)
          onValidation(false)
        } else {
          setAvailable(data.available)
          onValidation(data.available)
        }
      } catch (err) {
        setError("Failed to check username availability")
        onValidation(false)
      } finally {
        setChecking(false)
      }
    }

    // Debounce the check
    const timeoutId = setTimeout(checkUsername, 500)
    return () => clearTimeout(timeoutId)
  }, [value, onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-white">Choose Your Username</h2>
        <p className="text-white/60">This is how you&apos;ll be known on Delta AI</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            placeholder="Enter username"
            className="w-full bg-zinc-900/80 backdrop-blur-sm text-white placeholder:text-white/40 border border-white/10 rounded-xl py-4 px-6 focus:outline-none focus:border-indigo-500 text-lg pr-12"
            maxLength={20}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {checking && <Loader2 className="w-5 h-5 text-white/40 animate-spin" />}
            {!checking && available === true && <Check className="w-5 h-5 text-emerald-400" />}
            {!checking && available === false && <X className="w-5 h-5 text-red-400" />}
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm"
          >
            {error}
          </motion.p>
        )}

        {available === true && !error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-emerald-400 text-sm"
          >
            Username is available!
          </motion.p>
        )}

        {available === false && !error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm"
          >
            Username is already taken
          </motion.p>
        )}

        <p className="text-white/40 text-xs">
          3-20 characters • Letters, numbers, and underscores only
        </p>
      </div>
    </motion.div>
  )
}
