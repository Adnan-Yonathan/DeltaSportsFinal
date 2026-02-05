'use client'

import { SimpleHeader } from '@/components/ui/simple-header'
import WelcomeLanding from '@/components/welcome/WelcomeLanding'

export default function WelcomeClient() {
  return (
    <div className="min-h-screen bg-black">
      <SimpleHeader widthClass="max-w-6xl" />
      <WelcomeLanding />
    </div>
  )
}
