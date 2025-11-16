/**
 * Test Vercel AI Gateway Integration
 * Run with: npx tsx scripts/test-ai-gateway.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

// Explicitly load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

async function testAIGateway() {
  console.log('[AI_GATEWAY] Testing Vercel AI Gateway integration...\n')

  // Check if API key is configured
  if (!process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY === 'your_ai_gateway_api_key_here') {
    console.error('❌ AI_GATEWAY_API_KEY not configured in .env.local')
    console.log('\nTo get your API key:')
    console.log('1. Go to https://vercel.com/dashboard')
    console.log('2. Navigate to AI Gateway → API Keys')
    console.log('3. Click "Create Key"')
    console.log('4. Copy the key and add it to .env.local')
    process.exit(1)
  }

  try {
    // Test 1: GPT-4o (current model)
    console.log('Test 1: GPT-4o')
    const gpt4oResult = await generateText({
      model: openai('gpt-4o'),
      prompt: 'Say "Hello from GPT-4o" in exactly 5 words.',
      maxTokens: 20,
    })
    console.log(`✅ Response: ${gpt4oResult.text}`)
    console.log(`📊 Usage: ${gpt4oResult.usage.totalTokens} tokens\n`)

    // Test 2: GPT-5 (if available)
    console.log('Test 2: GPT-5')
    try {
      const gpt5Result = await generateText({
        model: openai('gpt-5'),
        prompt: 'Say "Hello from GPT-5" in exactly 5 words.',
        maxTokens: 20,
      })
      console.log(`✅ Response: ${gpt5Result.text}`)
      console.log(`📊 Usage: ${gpt5Result.usage.totalTokens} tokens\n`)
    } catch (error: any) {
      if (error.message?.includes('model_not_found') || error.message?.includes('does not exist')) {
        console.log('⚠️  GPT-5 not available yet\n')
      } else {
        throw error
      }
    }

    // Test 3: GPT-5-mini (if available)
    console.log('Test 3: GPT-5-mini')
    try {
      const gpt5miniResult = await generateText({
        model: openai('gpt-5-mini'),
        prompt: 'Say "Hello from GPT-5-mini" in exactly 5 words.',
        maxTokens: 20,
      })
      console.log(`✅ Response: ${gpt5miniResult.text}`)
      console.log(`📊 Usage: ${gpt5miniResult.usage.totalTokens} tokens\n`)
    } catch (error: any) {
      if (error.message?.includes('model_not_found') || error.message?.includes('does not exist')) {
        console.log('⚠️  GPT-5-mini not available yet\n')
      } else {
        throw error
      }
    }

    // Test 4: GPT-4o-mini (current title gen model)
    console.log('Test 4: GPT-4o-mini')
    const gpt4ominiResult = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Say "Hello from GPT-4o-mini" in exactly 5 words.',
      maxTokens: 20,
    })
    console.log(`✅ Response: ${gpt4ominiResult.text}`)
    console.log(`📊 Usage: ${gpt4ominiResult.usage.totalTokens} tokens\n`)

    console.log('🎉 All tests completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Check Vercel AI Gateway dashboard for usage analytics')
    console.log('2. Review which GPT-5 models are available')
    console.log('3. Update app/api/chat/route.ts to use AI Gateway')

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)

    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.log('\n⚠️  API key issue. Check that AI_GATEWAY_API_KEY is correct.')
    }

    process.exit(1)
  }
}

testAIGateway().catch(console.error)
