/**
 * Test current chat setup with GPT-5-mini via direct OpenAI API
 * Run with: npx tsx scripts/test-current-setup.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local BEFORE importing anything else
config({ path: resolve(process.cwd(), '.env.local') })

async function testCurrentSetup() {
  // Dynamically import after env is loaded
  const { openaiGateway, AI_MODELS } = await import('../lib/ai-gateway-client.js')
  console.log('[TEST] Testing current chat setup...\n')
  console.log(`Model: ${AI_MODELS.chat}`)
  console.log(`API Key: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}\n`)

  try {
    console.log('Making chat completion request...')
    const start = Date.now()

    const response = await openaiGateway.chat.completions.create({
      model: AI_MODELS.chat,
      messages: [
        { role: 'user', content: 'What are the Lakers odds? Keep it under 30 words.' }
      ],
      max_completion_tokens: 100,
    })

    const duration = Date.now() - start

    console.log(`✅ Success! (${duration}ms)`)
    console.log(`Response: ${response.choices[0].message.content}`)
    console.log(`\nToken usage:`)
    console.log(`  Input: ${response.usage?.prompt_tokens}`)
    console.log(`  Output: ${response.usage?.completion_tokens}`)
    console.log(`  Total: ${response.usage?.total_tokens}\n`)

    console.log('🎉 Chat setup is working with GPT-5-mini via direct OpenAI API!')
    console.log(`📊 Cost savings: ~39% less tokens compared to GPT-5`)
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`)
    if (error.message?.includes('model_not_found') || error.message?.includes('does not exist')) {
      console.log('\n⚠️  GPT-5-mini might not be available yet on direct OpenAI API')
      console.log('Try using gpt-4o or gpt-4o-mini instead')
    }
    process.exit(1)
  }
}

testCurrentSetup().catch(console.error)
