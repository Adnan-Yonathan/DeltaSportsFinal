'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import ChatIntro from '@/components/ChatIntro'

export default function WelcomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillMessage = searchParams.get('prompt') ?? undefined

  return (
    <ChatIntro
      conversationId=""
      userId=""
      onMessageSent={() => {}}
      isGuest={true}
      onSignUpClick={() => router.push('/auth/signup')}
      prefillMessage={prefillMessage}
    />
  )
}
