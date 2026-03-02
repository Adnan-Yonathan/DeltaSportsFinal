export type SeoBlogTopic = {
  slug: string
  primaryKeyword: string
  title: string
  topic: string
  metaDescription: string
}

export const SEO_BLOG_TOPICS: SeoBlogTopic[] = [
  {
    slug: 'sharp-money-sports-betting',
    primaryKeyword: 'sharp money sports betting',
    title: 'Sharp Money Sports Betting: How to Follow Real Market Signals',
    topic:
      'Explain how sharp money works, how to identify it in real time, and how bettors can build a repeatable process around it.',
    metaDescription:
      'Sharp money sports betting explained with real examples, market signals, and a step-by-step process serious bettors can use.',
  },
  {
    slug: 'reverse-line-movement-betting',
    primaryKeyword: 'reverse line movement betting',
    title: 'Reverse Line Movement Betting: Read the Market Like a Pro',
    topic:
      'Teach reverse line movement from basics to advanced reads and show how to avoid false positives.',
    metaDescription:
      'Reverse line movement betting guide: how to spot true steam, avoid traps, and use movement with context to improve decisions.',
  },
  {
    slug: 'sharp-money-tracker',
    primaryKeyword: 'sharp money tracker',
    title: 'Sharp Money Tracker: What to Track, When to Fade, and When to Follow',
    topic:
      'Show bettors how to use a sharp money tracker, rank signals by quality, and turn signals into disciplined long-term decisions.',
    metaDescription:
      'Sharp money tracker strategy for long-term bettors: signal scoring, practical workflows, and examples with real betting scenarios.',
  },
]

export const DEFAULT_GAME_PRIMARY_KEYWORD = 'sharp money sports betting'

export const getSeoBlogTopicBySlug = (slug: string) =>
  SEO_BLOG_TOPICS.find((topic) => topic.slug === slug)

