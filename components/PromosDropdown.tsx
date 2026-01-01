'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Tag, ExternalLink, ChevronDown, Calendar } from 'lucide-react'
import type { SportsbookPromo, PromoCategory } from '@/lib/types/promos'
import { US_STATES, PROMO_CATEGORIES } from '@/lib/types/promos'

interface PromosDropdownProps {
  variant?: 'desktop' | 'mobile'
}

export default function PromosDropdown({ variant = 'desktop' }: PromosDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [promos, setPromos] = useState<SportsbookPromo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<PromoCategory | 'all'>('all')
  const [selectedState, setSelectedState] = useState<string>('ALL')
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // Fetch promos
  useEffect(() => {
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
      }
    }
    fetchPromos()
  }, [selectedCategory, selectedState])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePromoClick = (promo: SportsbookPromo) => {
    window.open(promo.link, '_blank', 'noopener,noreferrer')
    setIsOpen(false)
  }

  const formatExpirationDate = (expiresAt?: string) => {
    if (!expiresAt) return null
    const date = new Date(expiresAt)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getCategoryLabel = (category: PromoCategory | 'all') => {
    switch (category) {
      case 'all': return 'All Promos'
      case 'new_user': return 'New User'
      case 'active_user': return 'Active User'
      case 'sport_specific': return 'Sport-Specific'
      case 'seasonal': return 'Seasonal'
      case PROMO_CATEGORIES.DAILY: return 'Daily'
      case PROMO_CATEGORIES.PEER_TO_PEER: return 'P2P Exchange'
      default: return category
    }
  }

  if (variant === 'mobile') {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-2 text-[#34d399] hover:text-[#16a34a] transition-colors"
        aria-label="View promotions"
      >
        <span className="text-sm font-semibold leading-none">$10k</span>
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:inline-flex items-center px-3 py-2 text-base font-semibold text-[#34d399] hover:text-[#16a34a] transition-colors"
      >
        <span className="text-base font-semibold leading-none">$10k</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-3 right-0 w-[420px] max-h-[650px] rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1f1f1f] bg-[#0a0a0a]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#34d399]" />
                Sportsbook Promos
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Latest offers from top sportsbooks
              </p>
            </div>

            {/* State Selector */}
            <div className="px-5 py-3 border-b border-[#1f1f1f] bg-[#0a0a0a]">
              <label className="text-xs font-medium text-white/70 mb-2 block">
                Select Your State
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-[#34d399] transition-colors"
              >
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code} className="bg-[#0f1f15] text-white">
                    {state.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="px-5 py-3 border-b border-[#1f1f1f] bg-[#0a0a0a]">
              <div className="flex gap-2 flex-wrap">
                {(['all', ...Object.values(PROMO_CATEGORIES)] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#34d399] text-black'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {getCategoryLabel(cat as any)}
                  </button>
                ))}
              </div>
            </div>

            {/* Promos List */}
            <div className="overflow-y-auto flex-1 bg-[#0a0a0a]" style={{ maxHeight: '400px' }}>
              {loading ? (
                <div className="px-5 py-8 text-center text-white/60 bg-[#0a0a0a]">
                  <div className="inline-block w-6 h-6 border-2 border-[#34d399] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-sm">Loading promos...</p>
                </div>
              ) : promos.length === 0 ? (
                <div className="px-5 py-8 text-center text-white/60 bg-[#0a0a0a]">
                  <Gift className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No promos available for {selectedState === 'ALL' ? 'this category' : US_STATES.find(s => s.code === selectedState)?.name}</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1f1f1f] bg-[#0a0a0a]">
                  {promos.map((promo) => (
                    <motion.button
                      key={promo.id}
                      onClick={() => handlePromoClick(promo)}
                      whileHover={{ backgroundColor: 'rgba(52, 211, 153, 0.08)' }}
                      className="w-full px-5 py-4 text-left transition-colors bg-[#0a0a0a]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Bookmaker + Featured Badge */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-bold text-white truncate">
                              {promo.bookmakerDisplayName}
                            </span>
                            {promo.featured && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#34d399] text-black flex-shrink-0">
                                FEATURED
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <p className="text-sm font-semibold text-[#34d399] mb-1.5 line-clamp-1">
                            {promo.title}
                          </p>

                          {/* Description */}
                          <p className="text-xs text-white/60 line-clamp-2 mb-2">
                            {promo.description}
                          </p>

                          {/* Promo Code */}
                          {promo.promoCode && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20 mb-2">
                              <Tag className="w-3 h-3 text-[#34d399]" />
                              <span className="text-xs font-mono font-bold text-white">
                                {promo.promoCode}
                              </span>
                            </div>
                          )}

                          {/* Expiration Date */}
                          {promo.expiresAt && (
                            <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-2">
                              <Calendar className="w-3 h-3" />
                              <span>Expires {formatExpirationDate(promo.expiresAt)}</span>
                            </div>
                          )}

                          {/* State Availability */}
                          {promo.states && promo.states.length > 0 && selectedState === 'ALL' && (
                            <div className="text-[11px] text-white/40 mt-1">
                              Available in: {promo.states.slice(0, 5).join(', ')}
                              {promo.states.length > 5 && ` +${promo.states.length - 5} more`}
                            </div>
                          )}
                        </div>

                        {/* External Link Icon */}
                        <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0 mt-1" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#1f1f1f] bg-[#0a0a0a]">
              <p className="text-[10px] text-white/40 text-center leading-relaxed">
                Promos subject to terms & conditions. 21+ only. Please gamble responsibly.
                <br />
                For help, visit{' '}
                <a
                  href="https://www.ncpgambling.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[#34d399] transition-colors"
                >
                  NCPG.org
                </a>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

