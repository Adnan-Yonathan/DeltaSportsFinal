'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Gift, Tag, ExternalLink, Calendar, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SportsbookPromo, PromoCategory } from '@/lib/types/promos'
import { US_STATES, PROMO_CATEGORIES } from '@/lib/types/promos'
import { DottedSurface } from '@/components/ui/dotted-surface'

const CATEGORY_TABS: Array<{ id: PromoCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Promos' },
  { id: 'new_user', label: 'New User' },
  { id: 'active_user', label: 'Active User' },
  { id: 'sport_specific', label: 'Sport-Specific' },
  { id: 'seasonal', label: 'Seasonal' },
]

export default function PromosPage() {
  const [promos, setPromos] = useState<SportsbookPromo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<PromoCategory | 'all'>('all')
  const [selectedState, setSelectedState] = useState<string>('ALL')
  const [refreshing, setRefreshing] = useState(false)

  const fetchPromos = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }
      if (selectedState !== 'ALL') {
        params.set('state', selectedState)
      }

      const response = await fetch(`/api/promos?${params.toString()}`)
      const data = await response.json()
      setPromos(data.promos || [])
    } catch (error) {
      console.error('Failed to fetch promos:', error)
      setPromos([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPromos()
  }, [selectedCategory, selectedState])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPromos()
  }

  const handlePromoClick = (promo: SportsbookPromo) => {
    window.open(promo.link, '_blank', 'noopener,noreferrer')
  }

  const formatExpirationDate = (expiresAt?: string) => {
    if (!expiresAt) return null
    const date = new Date(expiresAt)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DottedSurface className="fixed inset-0 -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Chat
              </Link>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Gift className="h-6 w-6 text-[#34d399]" />
                <h1 className="text-xl font-bold">Sportsbook Promos</h1>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Category Tabs */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-[#34d399] text-black'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* State Selector */}
          <div className="mt-4">
            <label className="text-xs font-medium text-white/50 mb-2 block">
              Filter by State
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-[#34d399] transition-colors"
            >
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code} className="bg-[#0f1f15] text-white">
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#34d399] border-t-transparent"></div>
            <p className="mt-4 text-sm text-white/60">Loading promos...</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Gift className="h-16 w-16 text-white/20 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No promos available</h3>
            <p className="text-sm text-white/60">
              {selectedState === 'ALL'
                ? 'No promos found for this category'
                : `No promos available in ${US_STATES.find((s) => s.code === selectedState)?.name}`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo) => (
              <motion.button
                key={promo.id}
                onClick={() => handlePromoClick(promo)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition-all hover:border-[#34d399]/50 hover:bg-white/10"
              >
                {/* Featured Badge */}
                {promo.featured && (
                  <div className="absolute top-4 right-4">
                    <span className="rounded-full bg-[#34d399] px-3 py-1 text-xs font-bold text-black">
                      FEATURED
                    </span>
                  </div>
                )}

                {/* Bookmaker */}
                <div className="mb-3">
                  <h3 className="text-base font-bold text-white">{promo.bookmakerDisplayName}</h3>
                </div>

                {/* Title */}
                <h4 className="mb-2 text-lg font-semibold text-[#34d399] line-clamp-2">
                  {promo.title}
                </h4>

                {/* Description */}
                <p className="mb-4 text-sm text-white/60 line-clamp-3">{promo.description}</p>

                {/* Value Badge */}
                {promo.value && (
                  <div className="mb-4 inline-block rounded-lg bg-[#34d399]/10 px-3 py-1.5 text-sm font-bold text-[#34d399]">
                    {promo.value}
                  </div>
                )}

                {/* Promo Code */}
                {promo.promoCode && (
                  <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2">
                    <Tag className="h-4 w-4 text-[#34d399]" />
                    <span className="font-mono text-sm font-bold text-white">{promo.promoCode}</span>
                  </div>
                )}

                {/* Expiration Date */}
                {promo.expiresAt && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-white/50">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Expires {formatExpirationDate(promo.expiresAt)}</span>
                  </div>
                )}

                {/* State Availability */}
                {promo.states && promo.states.length > 0 && selectedState === 'ALL' && (
                  <div className="mb-4 text-xs text-white/40">
                    Available in: {promo.states.slice(0, 5).join(', ')}
                    {promo.states.length > 5 && ` +${promo.states.length - 5} more`}
                  </div>
                )}

                {/* External Link Icon */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#34d399] group-hover:underline">
                    View Promo
                  </span>
                  <ExternalLink className="h-4 w-4 text-white/40 transition-colors group-hover:text-[#34d399]" />
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Legal Disclaimer */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-center text-xs leading-relaxed text-white/40">
            Promos subject to terms & conditions. 21+ only. Please gamble responsibly.
            <br />
            For help, visit{' '}
            <a
              href="https://www.ncpgambling.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-[#34d399]"
            >
              NCPG.org
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
