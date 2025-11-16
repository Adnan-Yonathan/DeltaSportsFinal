/**
 * Test if GPT-5 models work via direct OpenAI API
 * Run with: npx tsx scripts/test-gpt5-direct.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import OpenAI from 'openai'

// Load env first
config({ path: resolve(process.cwd(), '.env.local') })

async function testGPT5Direct() {
  console.log('[TEST] Testing GPT-5-mini via direct OpenAI API...\n')

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    console.log('Attempting chat completion with gpt-5-mini...')
    const start = Date.now()

    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'user', content: 'Say hello in exactly 5 words' }
      ],
      max_completion_tokens: 20,
    })

    const duration = Date.now() - start

    console.log(`✅ Success! (${duration}ms)`)
    console.log(`Response: ${response.choices[0].message.content}`)
    console.log(`Tokens: ${response.usage?.total_tokens}\n`)

    console.log('🎉 GPT-5-mini works with direct OpenAI API!')
    console.log('The chat route should work with gpt-5-mini configured.')
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`)

    if (error.message?.includes('model_not_found') || error.message?.includes('does not exist')) {
      console.log('\n⚠️  GPT-5 models are NOT available via direct OpenAI API')
      console.log('GPT-5 models might only be available through Vercel AI Gateway')
      console.log('\nOptions:')
      console.log('  1. Use gpt-4o or gpt-4o-mini instead')
      console.log('  2. Migrate chat route to AI SDK to use Vercel AI Gateway')
    }

    process.exit(1)
  }
}

testGPT5Direct().catch(console.error)
