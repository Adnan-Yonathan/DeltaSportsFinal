"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface VerificationCardProps {
  idNumber?: string
  name?: string
  validThru?: string
  label?: string
}

export function VerificationCard({
  idNumber = "ID **** 4590",
  name = "JANE DOE",
  validThru = "11/29",
  label = "IDENTITY CARD",
}: VerificationCardProps) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative h-52 w-80 rounded-2xl border border-white/30 bg-black p-6 text-emerald-200 shadow-[0_0_28px_rgba(255,255,255,0.45)] flex flex-col justify-between"
      )}
    >
      <div className="relative z-10 flex justify-between items-start text-xs tracking-wide">
        <span>{label}</span>
        <span>VALID</span>
      </div>

      <div className="relative z-10">
        <p className="text-lg tracking-widest font-semibold">{idNumber}</p>
        <div className="flex justify-between text-sm mt-2">
          <span>{name}</span>
          <span>{validThru}</span>
        </div>
      </div>
    </motion.div>
  )
}
