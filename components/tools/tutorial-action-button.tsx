'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TOOLS_TUTORIAL_LOCAL_KEY, TOOLS_TUTORIAL_METADATA_KEY } from '@/lib/tools-tutorial'

type TutorialActionButtonProps = {
  label: string
  redirectTo: string
  className: string
}

export function TutorialActionButton({
  label,
  redirectTo,
  className,
}: TutorialActionButtonProps) {
  const router = useRouter()

  const handleClick = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOOLS_TUTORIAL_LOCAL_KEY, '1')
    }

    try {
      const supabase = createClient()
      await supabase.auth.updateUser({
        data: {
          [TOOLS_TUTORIAL_METADATA_KEY]: true,
        },
      })
    } catch {
      // Best effort only.
    }

    router.push(redirectTo)
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {label}
    </button>
  )
}

