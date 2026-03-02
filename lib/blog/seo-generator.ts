import { openai } from '@/lib/ai-gateway-client'

type BlogSection = {
  h2: string
  paragraphs: string[]
  h3Blocks?: Array<{ h3: string; paragraphs: string[] }>
}

export type SeoFaqItem = {
  question: string
  answer: string
}

export type GeneratedSeoBlogPost = {
  h1: string
  slugSuggestion: string
  metaDescription: string
  introHook: string
  keyTakeaways: string[]
  sections: BlogSection[]
  conclusionCta: string
  faq: SeoFaqItem[]
  primaryKeyword: string
}

export type GenerateSeoBlogInput = {
  cacheKey: string
  primaryKeyword: string
  topic: string
  mode: 'evergreen' | 'game-specific'
  titleHint?: string
  context?: string
}

const SEO_WRITER_PROMPT = `
You are an expert SEO content writer specializing in sports betting. You write long-form blog posts (1,500–2,500 words) optimized for search engines while being genuinely useful to bettors ranging from beginner to advanced.

WRITING RULES:
- Write in a confident, direct tone — like a sharp bettor explaining to a friend
- No fluff, no generic advice. Every paragraph should teach something actionable
- Use real examples with specific numbers, lines, and scenarios where possible
- Naturally weave in LSI keywords and semantic variations throughout
- Structure every post with: H1 -> intro hook -> H2 sections -> FAQ schema section -> conclusion with CTA
- Internal link placeholders: [LINK: related post] wherever relevant
- End every post with 5 FAQ entries formatted for schema markup

SEO RULES:
- Primary keyword in: H1, first 100 words, one H2, meta description, URL slug suggestion
- Meta description: under 155 characters, includes primary keyword, has a click hook
- Use H2s and H3s to capture related long-tail keywords naturally
- Aim for featured snippet capture on definition-style questions
- Include a "Key Takeaways" box near the top for listicle-style snippets

CONTEXT:
- The blog is for Delta Sports, a sports betting analytics SaaS
- The platform tracks sharp money, whale bets, line movement, and AI-powered betting signals
- CTAs should naturally direct readers to try Delta Sports
- Never recommend specific sportsbooks by name.
`

const CACHE_TTL_MS = 1000 * 60 * 60 * 12
const cache = new Map<string, { expiresAt: number; post: GeneratedSeoBlogPost }>()

const blogModel =
  process.env.BLOG_MODEL ||
  process.env.SEARCH_MODEL ||
  process.env.RESEARCH_MODEL ||
  process.env.CHAT_MODEL ||
  'gpt-4o-mini'

const splitParagraphs = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return value
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const toText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const extractJsonObject = (value: string) => {
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return value.slice(start, end + 1)
}

const buildFallbackPost = (input: GenerateSeoBlogInput): GeneratedSeoBlogPost => {
  const keyword = input.primaryKeyword
  return {
    h1: input.titleHint || `${keyword}: actionable betting workflow`,
    slugSuggestion: keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    metaDescription: `${keyword} explained with actionable signal reads, examples, and a repeatable framework for long-term betting discipline.`.slice(
      0,
      154
    ),
    introHook: `Most bettors lose because they chase picks instead of process. ${keyword} only helps when you convert market signals into consistent execution rules you can repeat every week.`,
    keyTakeaways: [
      'Track signal quality before following any move.',
      'Use line movement with context, not in isolation.',
      'Prioritize price discipline over pick volume.',
      'Log every decision to identify leaks over time.',
    ],
    sections: [
      {
        h2: `${keyword}: what matters and what is noise`,
        paragraphs: [
          'Sharp action matters most when timing, liquidity, and price displacement align. A one-off move without supporting context is often noise.',
          'Treat every signal as a probability update, not a guaranteed win. The goal is to tilt expected value in your favor repeatedly, not to predict every outcome.',
          '[LINK: related post]',
        ],
      },
      {
        h2: 'Process framework you can run daily',
        paragraphs: [
          'Start with market scan: identify unusual size, sudden line shifts, and disagreement between public splits and current price.',
          'Then validate: compare current number to your fair range, remove stale markets, and skip entries with poor price.',
          'Finally execute with fixed staking and post-trade review notes. Your edge compounds from consistency, not hero calls.',
        ],
        h3Blocks: [
          {
            h3: 'Step 1: signal qualification',
            paragraphs: [
              'Score each signal by speed, volume, and cross-market confirmation.',
              'Downgrade signals that appear after major injury/news events already priced in.',
            ],
          },
          {
            h3: 'Step 2: entry discipline',
            paragraphs: [
              'Define acceptable entry bands before placing a bet.',
              'Pass on bets outside your target range instead of forcing action.',
            ],
          },
        ],
      },
      {
        h2: 'Long-term profitability rules',
        paragraphs: [
          'Think in sample size. Even strong signals can lose in short bursts, so bankroll control is mandatory.',
          'Separate outcome from decision quality. Grade your process with CLV and signal validity, then refine weekly.',
          'Delta Sports helps reduce noise by surfacing sharp flow, movement, and market context in one workflow.',
        ],
      },
    ],
    conclusionCta:
      'If you want a tighter routine, use Delta Sports to monitor sharp flow, compare movement, and execute only when your process confirms value.',
    faq: [
      {
        question: `What is ${keyword}?`,
        answer:
          'It is a betting approach that uses market behavior and liquidity signals to identify where stronger bettors may be positioned.',
      },
      {
        question: 'How many signals should I follow each day?',
        answer:
          'Only the highest-conviction signals that pass your pricing rules. Fewer qualified entries usually outperform high-volume guessing.',
      },
      {
        question: 'Does reverse line movement always mean value?',
        answer:
          'No. Reverse line movement is useful only with context like timing, market depth, and stale price checks.',
      },
      {
        question: 'How should I size bets long term?',
        answer:
          'Use a fixed, conservative stake model and track exposure across correlated markets to prevent variance spikes.',
      },
      {
        question: 'How does Delta Sports help?',
        answer:
          'Delta Sports centralizes sharp signals, whale activity, and movement context so you can make faster, cleaner decisions.',
      },
    ],
    primaryKeyword: keyword,
  }
}

const normalizeSections = (value: unknown): BlogSection[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((section) => {
      if (!section || typeof section !== 'object') return null
      const typed = section as Record<string, unknown>
      const h3Blocks = Array.isArray(typed.h3Blocks)
        ? typed.h3Blocks
            .map((block) => {
              if (!block || typeof block !== 'object') return null
              const typedBlock = block as Record<string, unknown>
              const h3 = toText(typedBlock.h3)
              const paragraphs = Array.isArray(typedBlock.paragraphs)
                ? typedBlock.paragraphs.map((p) => toText(p)).filter(Boolean)
                : splitParagraphs(typedBlock.body)
              if (!h3 || !paragraphs.length) return null
              return { h3, paragraphs }
            })
            .filter((block): block is { h3: string; paragraphs: string[] } => Boolean(block))
        : undefined

      const h2 = toText(typed.h2)
      const paragraphs = Array.isArray(typed.paragraphs)
        ? typed.paragraphs.map((p) => toText(p)).filter(Boolean)
        : splitParagraphs(typed.body)
      if (!h2 || !paragraphs.length) return null
      return { h2, paragraphs, ...(h3Blocks?.length ? { h3Blocks } : {}) }
    })
    .filter((section): section is BlogSection => Boolean(section))
}

const normalizeFaq = (value: unknown): SeoFaqItem[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const typed = item as Record<string, unknown>
      const question = toText(typed.question)
      const answer = toText(typed.answer)
      if (!question || !answer) return null
      return { question, answer }
    })
    .filter((item): item is SeoFaqItem => Boolean(item))
    .slice(0, 5)
}

const normalizeGeneratedPost = (
  candidate: unknown,
  fallback: GeneratedSeoBlogPost
): GeneratedSeoBlogPost => {
  if (!candidate || typeof candidate !== 'object') return fallback
  const typed = candidate as Record<string, unknown>
  const sections = normalizeSections(typed.sections)
  const faq = normalizeFaq(typed.faq)
  const keyTakeaways = Array.isArray(typed.keyTakeaways)
    ? typed.keyTakeaways.map((item) => toText(item)).filter(Boolean)
    : []

  return {
    h1: toText(typed.h1, fallback.h1),
    slugSuggestion: toText(typed.slugSuggestion, fallback.slugSuggestion),
    metaDescription: toText(typed.metaDescription, fallback.metaDescription).slice(0, 154),
    introHook: toText(typed.introHook, fallback.introHook),
    keyTakeaways: keyTakeaways.length ? keyTakeaways.slice(0, 6) : fallback.keyTakeaways,
    sections: sections.length ? sections : fallback.sections,
    conclusionCta: toText(typed.conclusionCta, fallback.conclusionCta),
    faq: faq.length ? faq : fallback.faq,
    primaryKeyword: toText(typed.primaryKeyword, fallback.primaryKeyword),
  }
}

const buildUserPrompt = (input: GenerateSeoBlogInput) => {
  const contextBlock = input.context?.trim()
    ? `\nCONTEXT DATA:\n${input.context.trim()}\n`
    : ''

  return `
Primary keyword: ${input.primaryKeyword}
Post mode: ${input.mode}
Topic goal: ${input.topic}
Title guidance: ${input.titleHint || 'Use the best SEO title you can create for this topic.'}
${contextBlock}
Return ONLY valid JSON in this shape:
{
  "h1": "string",
  "slugSuggestion": "string",
  "metaDescription": "string under 155 chars",
  "introHook": "string",
  "keyTakeaways": ["string", "string", "string", "string"],
  "sections": [
    {
      "h2": "string",
      "paragraphs": ["string", "string"],
      "h3Blocks": [
        {
          "h3": "string",
          "paragraphs": ["string"]
        }
      ]
    }
  ],
  "conclusionCta": "string",
  "faq": [
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" }
  ],
  "primaryKeyword": "string"
}

Hard requirements:
- 1,500 to 2,500 words in total.
- Put the primary keyword in H1, in introHook, and in at least one H2.
- Include natural semantic variations such as sharp money, line movement, market signals, and betting analytics.
- Keep content actionable with specific numeric examples.
- Keep the FAQ answers concise and schema-safe plain text.
`
}

export async function generateSeoBlogPost(
  input: GenerateSeoBlogInput
): Promise<GeneratedSeoBlogPost> {
  const now = Date.now()
  const cached = cache.get(input.cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.post
  }

  const fallback = buildFallbackPost(input)

  if (!process.env.OPENAI_API_KEY) {
    cache.set(input.cacheKey, { expiresAt: now + CACHE_TTL_MS, post: fallback })
    return fallback
  }

  try {
    const completion = await openai.chat.completions.create({
      model: blogModel,
      messages: [
        {
          role: 'system',
          content: SEO_WRITER_PROMPT,
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
      temperature: 0.4,
      ...(blogModel.includes('gpt-5')
        ? { max_completion_tokens: 7000 }
        : { max_tokens: 7000 }),
    })

    const raw = completion.choices?.[0]?.message?.content
    const text = typeof raw === 'string' ? raw.trim() : ''
    const jsonPayload = text ? extractJsonObject(text) : null
    if (!jsonPayload) {
      cache.set(input.cacheKey, { expiresAt: now + CACHE_TTL_MS, post: fallback })
      return fallback
    }

    const parsed = JSON.parse(jsonPayload)
    const normalized = normalizeGeneratedPost(parsed, fallback)
    cache.set(input.cacheKey, { expiresAt: now + CACHE_TTL_MS, post: normalized })
    return normalized
  } catch (error) {
    console.error('[BLOG_SEO] generation failed', error)
    cache.set(input.cacheKey, { expiresAt: now + CACHE_TTL_MS, post: fallback })
    return fallback
  }
}
