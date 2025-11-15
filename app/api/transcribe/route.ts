import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side transcription API route
 * Securely handles ElevenLabs API key and transcription requests
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for ElevenLabs API key
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    // Get audio blob from request
    const formData = await req.formData()
    const audioFile = formData.get('file')

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Audio file too large (max 10MB)' },
        { status: 400 }
      )
    }

    // Forward to ElevenLabs
    const elevenLabsFormData = new FormData()
    elevenLabsFormData.append('file', audioFile, 'recording.webm')
    elevenLabsFormData.append('model', 'eleven_monolingual_v1')

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
      },
      body: elevenLabsFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TRANSCRIBE] ElevenLabs error:', errorText)
      return NextResponse.json(
        { error: 'Transcription failed', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      text: result.text || '',
      success: true,
    })
  } catch (error: any) {
    console.error('[TRANSCRIBE] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
