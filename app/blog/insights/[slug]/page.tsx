import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import { SimpleHeader } from '@/components/ui/simple-header'
import { generateSeoBlogPost } from '@/lib/blog/seo-generator'
import { getSeoBlogTopicBySlug, SEO_BLOG_TOPICS } from '@/lib/blog/seo-topics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageParams = {
  slug: string
}

export function generateStaticParams() {
  return SEO_BLOG_TOPICS.map((topic) => ({ slug: topic.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: PageParams
}): Promise<Metadata> {
  const topic = getSeoBlogTopicBySlug(params.slug)
  if (!topic) {
    return {
      title: 'Delta Sports Blog',
      description: 'Sports betting analytics and sharp market education from Delta Sports.',
    }
  }

  return {
    title: topic.title,
    description: topic.metaDescription,
    openGraph: {
      title: topic.title,
      description: topic.metaDescription,
      type: 'article',
    },
    twitter: {
      title: topic.title,
      description: topic.metaDescription,
    },
  }
}

export default async function BlogInsightPage({
  params,
}: {
  params: PageParams
}) {
  const topic = getSeoBlogTopicBySlug(params.slug)
  if (!topic) notFound()

  const post = await generateSeoBlogPost({
    cacheKey: `insight:${topic.slug}`,
    mode: 'evergreen',
    primaryKeyword: topic.primaryKeyword,
    topic: topic.topic,
    titleHint: topic.title,
  })

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.h1,
    description: post.metaDescription,
    author: {
      '@type': 'Organization',
      name: 'Delta Sports',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Delta Sports',
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://deltasports.app/blog/insights/${params.slug}`,
    },
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.30} className="opacity-90" />
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-8 px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:px-10">
        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Delta Blog Insight
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {post.h1}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/75 sm:text-base">{post.introHook}</p>
          <div className="mt-4 text-xs text-white/65">
            <Link className="hover:text-emerald-200" href="/blog">
              Back to blog
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
            Key Takeaways
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            {post.keyTakeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </section>

        <article className="space-y-7">
          {post.sections.map((section) => (
            <section key={section.h2} className="rounded-3xl border border-white/10 bg-black/45 p-6">
              <h2 className="text-2xl font-semibold">{section.h2}</h2>
              <div className="mt-3 space-y-4 text-sm leading-7 text-white/80">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.h3Blocks?.length ? (
                <div className="mt-5 space-y-4">
                  {section.h3Blocks.map((block) => (
                    <div key={block.h3} className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">{block.h3}</h3>
                      <div className="space-y-3 text-sm leading-7 text-white/80">
                        {block.paragraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </article>

        <section className="rounded-3xl border border-white/10 bg-black/45 p-6">
          <h2 className="text-2xl font-semibold">FAQ</h2>
          <div className="mt-4 space-y-4">
            {post.faq.map((entry) => (
              <div key={entry.question} className="space-y-2">
                <h3 className="text-base font-semibold text-white">{entry.question}</h3>
                <p className="text-sm leading-7 text-white/80">{entry.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <h2 className="text-xl font-semibold">Conclusion</h2>
          <p className="mt-3 text-sm leading-7 text-white/80">{post.conclusionCta}</p>
          <Link
            href="/auth/signup"
            className="mt-4 inline-flex rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-200 hover:text-emerald-100"
          >
            Try Delta Sports
          </Link>
        </section>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  )
}
