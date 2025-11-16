/**
 * Compare GPT-5 Models
 * Run with: npm run compare:gpt5
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

// Explicitly load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const TEST_PROMPTS = {
  simple: 'Say "Hello from [MODEL]" in exactly 5 words.',
  chat: 'What are the Lakers vs Celtics odds? Provide a brief analysis.',
  complex: 'Analyze this betting scenario: Lakers are +150 moneyline, Celtics -180. Spread is Lakers +4.5 (-110). Which bet has better value and why? Keep it under 100 words.',
}

async function testModel(modelName: string, prompt: string, category: string) {
  try {
    const startTime = Date.now()
    const result = await generateText({
      model: openai(modelName),
      prompt,
      maxTokens: category === 'simple' ? 20 : category === 'chat' ? 200 : 300,
    })
    const duration = Date.now() - startTime

    return {
      model: modelName,
      category,
      response: result.text,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      duration,
      success: true,
    }
  } catch (error: any) {
    return {
      model: modelName,
      category,
      error: error.message,
      success: false,
    }
  }
}

async function compareModels() {
  console.log('🔬 GPT-5 Model Comparison\n')
  console.log('Testing models: gpt-5, gpt-5-mini, gpt-5-nano\n')
  console.log('=' .repeat(80))

  const models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano']
  const results: any[] = []

  // Test each model with each prompt
  for (const [category, prompt] of Object.entries(TEST_PROMPTS)) {
    console.log(`\n📝 Test: ${category.toUpperCase()}`)
    console.log(`Prompt: "${prompt}"\n`)

    for (const model of models) {
      process.stdout.write(`Testing ${model}... `)
      const result = await testModel(model, prompt, category)
      results.push(result)

      if (result.success) {
        console.log(`✅ ${result.totalTokens} tokens in ${result.duration}ms`)
      } else {
        console.log(`❌ ${result.error}`)
      }
    }
  }

  // Generate comparison report
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 COMPARISON REPORT\n')

  const successfulResults = results.filter(r => r.success)
  const byModel = new Map<string, any[]>()

  successfulResults.forEach(r => {
    if (!byModel.has(r.model)) {
      byModel.set(r.model, [])
    }
    byModel.get(r.model)!.push(r)
  })

  // Calculate averages
  console.log('Average Metrics:\n')
  console.log('Model           | Avg Tokens | Avg Input | Avg Output | Avg Time')
  console.log('-'.repeat(80))

  for (const [model, modelResults] of byModel.entries()) {
    const avgTotal = Math.round(modelResults.reduce((sum, r) => sum + r.totalTokens, 0) / modelResults.length)
    const avgInput = Math.round(modelResults.reduce((sum, r) => sum + r.inputTokens, 0) / modelResults.length)
    const avgOutput = Math.round(modelResults.reduce((sum, r) => sum + r.outputTokens, 0) / modelResults.length)
    const avgTime = Math.round(modelResults.reduce((sum, r) => sum + r.duration, 0) / modelResults.length)

    console.log(
      `${model.padEnd(15)} | ${String(avgTotal).padStart(10)} | ${String(avgInput).padStart(9)} | ${String(avgOutput).padStart(10)} | ${avgTime}ms`
    )
  }

  // Sample responses
  console.log('\n' + '='.repeat(80))
  console.log('\n📝 Sample Responses (Complex Task):\n')

  const complexResults = successfulResults.filter(r => r.category === 'complex')
  complexResults.forEach(r => {
    console.log(`\n${r.model.toUpperCase()}:`)
    console.log(`${r.response}`)
    console.log(`(${r.totalTokens} tokens, ${r.duration}ms)`)
  })

  // Recommendations
  console.log('\n' + '='.repeat(80))
  console.log('\n💡 RECOMMENDATIONS:\n')

  const gpt5Results = byModel.get('gpt-5') || []
  const miniResults = byModel.get('gpt-5-mini') || []
  const nanoResults = byModel.get('gpt-5-nano') || []

  if (gpt5Results.length > 0 && miniResults.length > 0 && nanoResults.length > 0) {
    const gpt5Avg = gpt5Results.reduce((sum, r) => sum + r.totalTokens, 0) / gpt5Results.length
    const miniAvg = miniResults.reduce((sum, r) => sum + r.totalTokens, 0) / miniResults.length
    const nanoAvg = nanoResults.reduce((sum, r) => sum + r.totalTokens, 0) / nanoResults.length

    console.log('Based on token efficiency:\n')

    if (nanoAvg < miniAvg && nanoAvg < gpt5Avg) {
      console.log('🏆 GPT-5-nano - Most efficient (lowest token usage)')
      console.log('   Best for: Title generation, simple filters, yes/no questions')
    }

    if (miniAvg < gpt5Avg) {
      console.log('⭐ GPT-5-mini - Best balance')
      console.log('   Best for: Main chat, analysis, recommendations')
    }

    console.log('💎 GPT-5 - Highest quality (but most expensive)')
    console.log('   Best for: Premium features, complex analysis')

    console.log(`\n📊 Token usage ratio:`)
    console.log(`   GPT-5: ${Math.round(gpt5Avg)} tokens`)
    console.log(`   GPT-5-mini: ${Math.round(miniAvg)} tokens (${Math.round((1 - miniAvg/gpt5Avg) * 100)}% less)`)
    console.log(`   GPT-5-nano: ${Math.round(nanoAvg)} tokens (${Math.round((1 - nanoAvg/gpt5Avg) * 100)}% less)`)
  } else {
    console.log('⚠️  Not all models completed successfully')
    console.log('   Available models:', Array.from(byModel.keys()).join(', '))
  }

  console.log('\n' + '='.repeat(80))
}

compareModels().catch(console.error)
