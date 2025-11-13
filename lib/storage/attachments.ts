import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

const bucket = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET || 'attachments'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function uploadAttachment(file: File, userId: string) {
  const extension = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw error
  }

  return path
}

export async function registerAttachment({
  conversationId,
  storagePath,
  file,
  type,
  betId,
}: {
  conversationId: string
  storagePath: string
  file: File
  type: 'image' | 'document'
  betId?: string
}) {
  const response = await fetch('/api/attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      type,
      betId: betId ?? null,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || 'Failed to register attachment')
  }

  return response.json()
}
