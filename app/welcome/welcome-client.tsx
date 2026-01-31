'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import ChatIntro from '@/components/ChatIntro'
import { SimpleHeader } from '@/components/ui/simple-header'

export default function WelcomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillMessage = searchParams.get('prompt') ?? undefined

  return (
    <div className="min-h-screen bg-black">
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="pt-20 sm:pt-24">
        <ChatIntro
          conversationId=""
          userId=""
          onMessageSent={() => {}}
          isGuest={true}
          onSignUpClick={() => router.push('/auth/signup')}
          prefillMessage={prefillMessage}
        />
      </div>
    </div>
  )
}
