"use client"

import * as React from "react"
import { VerificationCard } from "@/components/ui/verification-card"

export default function VerificationCardDemo() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center bg-muted/30">
      <a
        href="https://www.ruixen.com/?utm_source=21st.dev"
        target="_blank"
        rel="noopener noreferrer"
      >
        <VerificationCard
          idNumber="**** **** **** 7421"
          name="DELTA SPORTS"
          validThru="07/31"
          label="VERIFICATION CARD"
        />
      </a>
    </div>
  )
}

