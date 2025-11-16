# Vercel AI Gateway Migration Guide

This guide shows how to migrate your existing OpenAI usage to Vercel AI Gateway for cost optimization, caching, and better analytics.

## ✅ Installation Complete

The following packages have been installed:
- ✅ `ai` - Vercel AI SDK
- ✅ `@ai-sdk/openai` - OpenAI provider for AI SDK
- ✅ `dotenv` - Already installed
- ✅ `@types/node` - Already installed
- ✅ `typescript` - Already installed

## 📝 Setup Steps

### 1. Get Your AI Gateway API Key

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **AI Gateway** → **API Keys**
3. Click **"Create Key"**
4. Copy the generated key
5. Add it to `.env.local`:

```bash
AI_GATEWAY_API_KEY=your_actual_key_here
```

### 2. Test the Integration

Run the test script to verify everything works:

```bash
npx tsx scripts/test-ai-gateway.ts
```

Expected output:
```
[AI_GATEWAY] Testing Vercel AI Gateway integration...

Test 1: GPT-4o
✅ Response: Hello from GPT-4o
📊 Usage: 15 tokens

Test 2: GPT-5
✅ Response: Hello from GPT-5
📊 Usage: 14 tokens

🎉 All tests completed successfully!
```

If GPT-5 isn't available yet, you'll see:
```
⚠️  GPT-5 not available yet
```

## 🔄 Migration Options

### Option A: Minimal Migration (Recommended First Step)

**Pros:**
- Minimal code changes
- Easy to rollback
- Keep existing OpenAI SDK code

**Changes needed:**

1. Update `app/api/chat/route.ts`:

```typescript
// Before:
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// After:
import { openaiGateway as openai } from '@/lib/ai-gateway-client'

// That's it! All existing code works the same
```

2. Benefits:
   - ✅ Automatic semantic caching
   - ✅ Cost analytics in Vercel dashboard
   - ✅ Budget controls
   - ✅ Failover capabilities
   - ✅ Zero code changes beyond import

### Option B: Full AI SDK Migration (Long-term)

**Pros:**
- Better TypeScript types
- Streaming support
- Multi-provider switching
- Better error handling

**Changes needed:**

1. Update `app/api/chat/route.ts`:

```typescript
// Before:
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: openaiMessages,
  tools: ASSISTANT_TOOLS,
})

// After:
import { generateText } from 'ai'
import { openai } from '@/lib/ai-gateway-client'

const result = await generateText({
  model: openai('gpt-4o'),
  messages: openaiMessages,
  tools: ASSISTANT_TOOLS,
})
```

2. Convert function calling format
3. Update streaming logic
4. Migrate all endpoints

**Estimated Time:** 2-4 hours

## 🎯 Recommended Migration Path

### Phase 1: Test & Validate (15 minutes)

1. ✅ Get AI Gateway API key
2. ✅ Add to `.env.local`
3. ✅ Run test script
4. ✅ Check Vercel dashboard for analytics

### Phase 2: Main Chat Migration (30 minutes)

**File:** `app/api/chat/route.ts`

```typescript
// Line 20 - Update import
import { openaiGateway as openai } from '@/lib/ai-gateway-client'

// Line 1984 - Try GPT-5-mini if available
const initialResponse = await openai.chat.completions.create({
  model: 'gpt-5-mini', // or 'gpt-4o' if GPT-5 not available
  messages: openaiMessages,
  tools: ASSISTANT_TOOLS,
  temperature: 0.7,
  max_tokens: 4000,
})
```

### Phase 3: Title Generation Migration (15 minutes)

**File:** `app/api/chat/route.ts`

```typescript
// Line 59 - Switch to cheaper model
const completion = await openai.chat.completions.create({
  model: 'gpt-5-nano', // or 'gpt-4o-mini' if GPT-5 not available
  messages: [...]
})
```

### Phase 4: Custom Filters Migration (15 minutes)

**File:** `lib/models/filters/custom-gpt.ts`

```typescript
// Line 6 - Update import
import { openaiGateway } from '@/lib/ai-gateway-client'

// Line 22 - Update initialization
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = openaiGateway
  }
  return openaiClient
}

// Line 55 - Switch to cheaper model
const response = await openai.chat.completions.create({
  model: 'gpt-5-nano', // or 'gpt-4o-mini'
  messages: [...]
})
```

### Phase 5: Model Runner Migration (15 minutes)

**File:** `lib/models/model-runner.ts`

```typescript
// Line 74 - Update client
import { openaiGateway } from '@/lib/ai-gateway-client'

const openaiClient = process.env.OPENAI_API_KEY
  ? openaiGateway
  : null
```

## 🧪 Testing Strategy

### A/B Test GPT-5 vs GPT-4o

Add this to your chat route:

```typescript
// Environment-based model selection
const chatModel = process.env.AI_CHAT_MODEL || 'gpt-4o'

const response = await openai.chat.completions.create({
  model: chatModel,
  messages: openaiMessages,
})

console.log(`[CHAT] Using model: ${chatModel}`)
```

Then in `.env.local`:

```bash
# Test GPT-5
AI_CHAT_MODEL=gpt-5-mini

# Or stick with GPT-4o
AI_CHAT_MODEL=gpt-4o
```

Deploy and monitor:
- Response quality
- Cost per request
- User satisfaction
- Response time

## 📊 Cost Optimization

### Expected Savings

**Current (without AI Gateway):**
- Main chat: `gpt-4o` @ $2.50/$10 per 1M tokens
- Title gen: `gpt-4o-mini` @ $0.15/$0.60 per 1M tokens
- Filters: `gpt-4o-mini` @ $0.15/$0.60 per 1M tokens

**Optimized (with AI Gateway + GPT-5-nano):**
- Main chat: `gpt-5-mini` @ ~same cost, better quality
- Title gen: `gpt-5-nano` @ ~50% less than gpt-4o-mini
- Filters: `gpt-5-nano` @ ~50% less than gpt-4o-mini
- **Semantic caching:** 20-30% additional savings

**Total Expected Savings:** 30-50% reduction

### Monitor in Vercel Dashboard

1. Go to **AI Gateway** → **Analytics**
2. View:
   - Total requests
   - Cache hit rate
   - Cost per model
   - Token usage trends
   - Response times

## 🚨 Rollback Plan

If anything goes wrong:

1. **Revert environment variable:**
   ```bash
   # In .env.local, remove or comment out:
   # AI_GATEWAY_API_KEY=...
   ```

2. **Revert imports:**
   ```typescript
   // Change back to:
   import OpenAI from 'openai'
   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
   ```

3. **Redeploy**

## 🎉 Success Metrics

After migration, you should see:

- ✅ Lower OpenAI costs (check Vercel dashboard)
- ✅ Cache hit rate 20%+ (similar queries cached)
- ✅ Same or better response quality
- ✅ Detailed analytics per endpoint
- ✅ Budget alerts working

## 📚 Additional Resources

- [Vercel AI Gateway Docs](https://vercel.com/docs/ai-gateway)
- [AI SDK Documentation](https://ai-sdk.dev)
- [OpenAI Provider Docs](https://ai-sdk.dev/providers/ai-sdk-providers/openai)

## 🆘 Troubleshooting

### "AI_GATEWAY_API_KEY not configured"
- Make sure you created the key in Vercel dashboard
- Check `.env.local` has the correct key
- Restart dev server: `npm run dev`

### "model_not_found: gpt-5"
- GPT-5 not available yet
- Stick with `gpt-4o` or `gpt-5-mini` for now
- Check Vercel docs for available models

### "401 Unauthorized"
- API key might be wrong
- Regenerate key in Vercel dashboard
- Update `.env.local`

### High costs
- Check Vercel dashboard analytics
- Verify semantic caching is enabled
- Review model choices (nano vs mini vs full)

---

**Status:** Ready to migrate! 🚀

**Next Step:** Get your AI Gateway API key and run the test script.
