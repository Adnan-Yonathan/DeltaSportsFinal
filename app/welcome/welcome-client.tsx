'use client'

import { Header } from '@/components/ui/header-1'
import WelcomeLanding from '@/components/welcome/WelcomeLanding'

export default function WelcomeClient() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <WelcomeLanding />
    </div>
  )
}
