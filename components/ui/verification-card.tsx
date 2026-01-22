"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface VerificationCardProps {
  backgroundImage?: string
  backgroundPosition?: string
  idNumber?: string
  name?: string
  validThru?: string
  label?: string
}

export function VerificationCard({
  backgroundImage = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80",
  backgroundPosition = "center",
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
        "relative h-52 w-80 rounded-2xl p-6 shadow-2xl text-white flex flex-col justify-between bg-cover"
      )}
      style={{ backgroundImage: `url(${backgroundImage})`, backgroundPosition }}
    >
      <div className="absolute inset-0 rounded-2xl bg-black/50" />
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
