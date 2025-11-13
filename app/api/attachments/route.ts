import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Database } from '@/lib/supabase/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const ATTACHMENTS_BUCKET =
  process.env.ATTACHMENTS_BUCKET ||
  process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET ||
  'attachments'
const ATTACHMENT_ANALYSIS_MODEL =
  process.env.ATTACHMENT_ANALYSIS_MODEL || 'gpt-4o-mini'

type AttachmentRow = Database['public']['Tables']['attachments']['Row']

type AttachmentUpdate = Partial<
  Pick<
    AttachmentRow,
    'analysis_status' | 'extracted_text' | 'analysis_json' | 'analyzed_at' | 'error_message'
  >
>

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      conversationId,
      storagePath,
      fileName,
      mimeType,
      sizeBytes,
      type = 'image',
      betId,
    } = body

    if (!conversationId || !storagePath) {
      return NextResponse.json(
        { error: 'conversationId and storagePath are required' },
        { status: 400 }
      )
    }

    if (!['image', 'document'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid attachment type' },
        { status: 400 }
      )
    }

    // Verify conversation ownership
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: attachment, error } = await supabase
      .from('attachments')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        bet_id: betId || null,
        type,
        storage_path: storagePath,
        original_name: fileName || null,
        mime_type: mimeType || null,
        size_bytes: sizeBytes ?? null,
      })
      .select()
      .single()

    if (error || !attachment) {
      console.error('[ATTACHMENTS] Insert failed:', error)
      return NextResponse.json(
        { error: 'Failed to record attachment' },
        { status: 500 }
      )
    }

    // Fire-and-forget analysis
    void analyzeAttachment(attachment).catch((analysisError) => {
      console.error('[ATTACHMENTS] Analysis failed:', analysisError)
    })

    return NextResponse.json({ attachment })
  } catch (error: any) {
    console.error('[ATTACHMENTS] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

async function analyzeAttachment(attachment: AttachmentRow) {
  const admin = createServiceClient()

  try {
    const { data: signedUrl, error: signedUrlError } = await admin.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.storage_path, 60 * 30) // 30 minutes

    if (signedUrlError || !signedUrl) {
      throw new Error(
        `Failed to create signed URL: ${signedUrlError?.message ?? 'unknown error'}`
      )
    }

    const prompt =
      attachment.type === 'image'
        ? 'You are DELTA, a sports betting assistant. Extract information from the attached bet slip image. Respond with JSON containing: summary, bet_slip (teams, league, bet_type, odds, stake, book, notes), and confidence (0-1).'
        : 'You are DELTA, a sports betting assistant. Summarize the attached document and extract any relevant statistics or betting insights. Respond with JSON containing summary, key_points (array of strings), and confidence (0-1).'

    const completion = await openai.chat.completions.create({
      model: ATTACHMENT_ANALYSIS_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this attachment and return JSON per instructions.',
            },
            {
              type: 'image_url',
              image_url: { url: signedUrl.signedUrl },
            },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const parsed = safeJsonParse(content)

    const successUpdate: AttachmentUpdate = {
      analysis_status: 'ready',
      extracted_text:
        typeof parsed?.summary === 'string' ? parsed.summary : content,
      analysis_json: (parsed ?? { raw: content }) as AttachmentRow['analysis_json'],
      analyzed_at: new Date().toISOString(),
    }

    await admin.from('attachments').update(successUpdate).eq('id', attachment.id)
  } catch (error: any) {
    const failureUpdate: AttachmentUpdate = {
      analysis_status: 'failed',
      error_message: error.message,
    }

    await admin.from('attachments').update(failureUpdate).eq('id', attachment.id)

    throw error
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
