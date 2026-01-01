"use client"
import React, { useEffect } from "react"
import { motion } from "framer-motion"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"

interface StepPricingProps {
  value: string | null
  onChange: (value: string | null) => void
  onValidation: (isValid: boolean) => void
}

export function StepPricing({ onValidation }: StepPricingProps) {
  useEffect(() => {
    onValidation(true)
  }, [onValidation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <PricingSectionDemo />
    </motion.div>
  )
}
