/**
 * Test if OpenAI SDK works with Vercel AI Gateway API key
 * Run with: npx tsx scripts/test-openai-sdk-gateway.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import OpenAI from 'openai'

// Explicitly load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

async function testOpenAISDK() {
  console.log('[TEST] Testing OpenAI SDK with vck_ API key...\n')

  const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
  })

  try {
    console.log('Test 1: Chat completion with gpt-5-mini')
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'Say "Hello from OpenAI SDK" in exactly 5 words' }],
      max_tokens: 20,
    })

    console.log(`✅ Response: ${response.choices[0].message.content}`)
    console.log(`📊 Usage: ${response.usage?.total_tokens} tokens\n`)

    console.log('🎉 OpenAI SDK works with vck_ API key!')
    console.log('This means the current chat route should work with AI Gateway.\n')
  } catch (error: any) {
    console.error('❌ OpenAI SDK does NOT work with vck_ API key')
    console.error(`Error: ${error.message}\n`)
    console.log('This means we need to migrate to the AI SDK for AI Gateway to work.')
    process.exit(1)
  }
}

testOpenAISDK().catch(console.error)
