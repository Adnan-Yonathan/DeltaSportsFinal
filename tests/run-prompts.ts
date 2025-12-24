/**
 * Prompt Test Runner for Delta AI
 *
 * Runs 100 prompts through the /api/chat endpoint and logs results.
 *
 * Usage:
 *   npx ts-node tests/run-prompts.ts
 *
 * Environment Variables:
 *   BASE_URL - API base URL (default: http://localhost:3000)
 *   TEST_USER_ID - Supabase user ID for testing
 *   TEST_CONVERSATION_ID - Conversation ID (will create new if not provided)
 *   AUTH_COOKIE - Supabase auth cookie from browser (sb-*-auth-token)
 *   CONCURRENCY - Number of parallel requests (default: 1)
 *   START_FROM - Start from prompt ID (default: 1)
 *   END_AT - End at prompt ID (default: 100)
 *   DRY_RUN - Set to "true" to just validate prompts without sending
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

interface Prompt {
  id: number
  category: string
  text: string
  capability?: string
}

interface TestResult {
  id: number
  category: string
  prompt: string
  success: boolean
  responsePreview?: string
  toolsCalled?: string[]
  error?: string
  durationMs: number
}

interface PromptsFile {
  prompts: Prompt[]
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_USER_ID = process.env.TEST_USER_ID || ''
const TEST_CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || `test-${Date.now()}`
const AUTH_COOKIE = process.env.AUTH_COOKIE || ''
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10)
const START_FROM = parseInt(process.env.START_FROM || '1', 10)
const END_AT = parseInt(process.env.END_AT || '100', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'
const TEST_BYPASS = process.env.TEST_BYPASS === 'true'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function sendPrompt(prompt: Prompt): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_COOKIE ? { 'Cookie': AUTH_COOKIE } : {}),
      },
      body: JSON.stringify({
        message: prompt.text,
        conversationId: `${TEST_CONVERSATION_ID}-${prompt.id}`,
        userId: TEST_USER_ID,
        timezone: 'America/New_York',
        mode: 'regular',
        ...(prompt.capability ? { capability: prompt.capability } : {}),
        ...(TEST_BYPASS ? { testBypass: true } : {}),
      }),
    })

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      return {
        id: prompt.id,
        category: prompt.category,
        prompt: prompt.text,
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        durationMs,
      }
    }

    // Read streaming response
    const reader = response.body?.getReader()
    let fullResponse = ''

    if (reader) {
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullResponse += decoder.decode(value, { stream: true })
      }
    }

    // Try to extract tool calls from response (if visible in stream)
    const toolMatches = fullResponse.match(/tool_call|function_call/gi)
    const toolsCalled = toolMatches ? ['detected'] : []

    return {
      id: prompt.id,
      category: prompt.category,
      prompt: prompt.text,
      success: true,
      responsePreview: fullResponse.slice(0, 300).replace(/\n/g, ' '),
      toolsCalled,
      durationMs,
    }
  } catch (error) {
    return {
      id: prompt.id,
      category: prompt.category,
      prompt: prompt.text,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    }
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runTests() {
  // Load prompts
  const promptsPath = path.join(__dirname, 'prompts.json')
  const promptsData: PromptsFile = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'))

  // Filter prompts by range
  const prompts = promptsData.prompts.filter(p => p.id >= START_FROM && p.id <= END_AT)

  log(`\n========================================`, 'cyan')
  log(`  Delta AI Prompt Test Runner`, 'cyan')
  log(`========================================\n`, 'cyan')

  log(`Base URL: ${BASE_URL}`)
  log(`Prompts to test: ${prompts.length} (${START_FROM}-${END_AT})`)
  log(`Concurrency: ${CONCURRENCY}`)
  log(`Conversation prefix: ${TEST_CONVERSATION_ID}`)
  log(`User ID: ${TEST_USER_ID || '(not set - will likely fail auth)'}`)
  log(`Auth Cookie: ${AUTH_COOKIE ? '(set)' : '(not set - will likely fail auth)'}`)

  if (!TEST_USER_ID || !AUTH_COOKIE) {
    log(`\nWARNING: Missing TEST_USER_ID or AUTH_COOKIE`, 'yellow')
    log(`Most prompts will fail with 401 Unauthorized`, 'yellow')
    log(`\nTo get your auth cookie:`, 'yellow')
    log(`  1. Open your app in browser and log in`, 'dim')
    log(`  2. Open DevTools > Application > Cookies`, 'dim')
    log(`  3. Copy the full cookie string (sb-*-auth-token=...)`, 'dim')
    log(`  4. Set AUTH_COOKIE env var`, 'dim')
  }

  if (DRY_RUN) {
    log(`\nDRY RUN - Prompts will not be sent\n`, 'yellow')
    prompts.forEach(p => {
      log(`[${p.id}] ${p.category}: ${p.text.slice(0, 60)}...`, 'dim')
    })
    return
  }

  log(`\nStarting tests...\n`, 'cyan')

  const results: TestResult[] = []
  const categoryStats: Record<string, { passed: number; failed: number }> = {}

  // Process prompts with concurrency
  for (let i = 0; i < prompts.length; i += CONCURRENCY) {
    const batch = prompts.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(sendPrompt))

    for (const result of batchResults) {
      results.push(result)

      // Track category stats
      if (!categoryStats[result.category]) {
        categoryStats[result.category] = { passed: 0, failed: 0 }
      }
      if (result.success) {
        categoryStats[result.category].passed++
      } else {
        categoryStats[result.category].failed++
      }

      // Log result
      const status = result.success ? `${colors.green}PASS` : `${colors.red}FAIL`
      const duration = `${result.durationMs}ms`
      log(`[${result.id.toString().padStart(3)}] ${status}${colors.reset} ${result.category.padEnd(20)} ${duration.padStart(8)}`)

      if (!result.success) {
        log(`       Error: ${result.error}`, 'red')
      } else if (result.responsePreview) {
        log(`       ${result.responsePreview.slice(0, 80)}...`, 'dim')
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + CONCURRENCY < prompts.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Summary
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const avgDuration = Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)

  log(`\n========================================`, 'cyan')
  log(`  Summary`, 'cyan')
  log(`========================================\n`, 'cyan')

  log(`Total: ${results.length}`)
  log(`Passed: ${passed}`, passed > 0 ? 'green' : 'reset')
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'reset')
  log(`Avg Duration: ${avgDuration}ms`)

  log(`\nBy Category:`, 'cyan')
  for (const [category, stats] of Object.entries(categoryStats)) {
    const pct = Math.round((stats.passed / (stats.passed + stats.failed)) * 100)
    const color = pct === 100 ? 'green' : pct >= 50 ? 'yellow' : 'red'
    log(`  ${category.padEnd(25)} ${stats.passed}/${stats.passed + stats.failed} (${pct}%)`, color)
  }

  // Write detailed results to file
  const resultsPath = path.join(__dirname, `results-${Date.now()}.json`)
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { BASE_URL, START_FROM, END_AT, CONCURRENCY },
    summary: { total: results.length, passed, failed, avgDuration },
    categoryStats,
    results,
  }, null, 2))

  log(`\nDetailed results written to: ${resultsPath}`, 'dim')

  // List failures
  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    log(`\n========================================`, 'red')
    log(`  Failed Prompts`, 'red')
    log(`========================================\n`, 'red')

    for (const f of failures) {
      log(`[${f.id}] ${f.prompt}`)
      log(`    Error: ${f.error}`, 'red')
    }
  }

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)
