import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SimpleHeader } from "@/components/ui/simple-header"
import { OddsMatrixSurface } from "@/components/ui/odds-matrix-surface"
import { getCalculator, getPublishedCalculators } from "@/lib/calculators/registry"
import KellyWidget from "@/components/calculators/widgets/kelly-widget"
import KellyContent, { kellyFaqSchema } from "@/components/calculators/content/kelly-content"

const BASE_URL = "https://deltasports.app"

export const dynamicParams = false

export async function generateStaticParams() {
  return getPublishedCalculators().map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const entry = getCalculator(params.slug)
  if (!entry || !entry.published) return {}
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: `${BASE_URL}/calculators/${entry.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: `${BASE_URL}/calculators/${entry.slug}`,
      type: "website",
    },
  }
}

const WIDGETS: Record<string, () => JSX.Element> = {
  "kelly-criterion": () => <KellyWidget />,
}

const CONTENT: Record<string, () => JSX.Element> = {
  "kelly-criterion": () => <KellyContent />,
}

const FAQ_SCHEMAS: Record<string, unknown> = {
  "kelly-criterion": kellyFaqSchema,
}

export default function CalculatorPage({ params }: { params: { slug: string } }) {
  const entry = getCalculator(params.slug)
  if (!entry || !entry.published) notFound()

  const Widget = WIDGETS[entry.slug]
  const Content = CONTENT[entry.slug]
  const faqSchema = FAQ_SCHEMAS[entry.slug]

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${entry.name} Calculator`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    url: `${BASE_URL}/calculators/${entry.slug}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    creator: { "@type": "Organization", name: "Delta Sports" },
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Calculators", item: `${BASE_URL}/calculators` },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.name,
        item: `${BASE_URL}/calculators/${entry.slug}`,
      },
    ],
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      <OddsMatrixSurface intensity={0.26} className="opacity-90" />
      <SimpleHeader
        rightSlot={
          <Link
            href="/calculators"
            className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
          >
            All calculators
          </Link>
        }
      />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <nav className="mb-6 text-xs uppercase tracking-[0.3em] text-white/40">
          <Link href="/" className="hover:text-emerald-200">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/calculators" className="hover:text-emerald-200">Calculators</Link>
          <span className="mx-2">/</span>
          <span className="text-emerald-200">{entry.name}</span>
        </nav>

        <header className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Calculator
          </p>
          <h1 className="mt-3 font-hero text-3xl font-bold tracking-tight sm:text-4xl">
            {entry.name} Calculator
          </h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">{entry.description}</p>
        </header>

        <div className="mt-8">{Widget && <Widget />}</div>

        {Content && <Content />}
      </main>
    </div>
  )
}
