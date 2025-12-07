'use client'

import { useState } from 'react'
import { SPORTS } from '@/lib/types/odds'

interface BetModalProps {
  userId: string
  conversationId?: string
  onClose: () => void
  onSuccess: () => void
}

const SPORT_OPTIONS = [
  { value: 'basketball_nba', label: 'NBA', league: 'NBA' },
  { value: 'americanfootball_nfl', label: 'NFL', league: 'NFL' },
  { value: 'baseball_mlb', label: 'MLB', league: 'MLB' },
  { value: 'icehockey_nhl', label: 'NHL', league: 'NHL' },
  { value: 'basketball_ncaab', label: 'NCAA Basketball', league: 'NCAAB' },
  { value: 'americanfootball_ncaaf', label: 'NCAA Football', league: 'NCAAF' },
]

const BET_TYPES = [
  { value: 'spread', label: 'Spread' },
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'total', label: 'Total (Over/Under)' },
]

const BOOKMAKERS = [
  'FanDuel',
  'DraftKings',
  'BetMGM',
  'Caesars',
  'Bet365',
  'Pinnacle',
  'Other',
]

export default function BetModal({
  userId,
  conversationId,
  onClose,
  onSuccess,
}: BetModalProps) {
  const [formData, setFormData] = useState({
    sport: '',
    league: '',
    gameDescription: '',
    betType: '',
    betSide: '',
    odds: '',
    stake: '',
    book: '',
    gameTime: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/bets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sport: formData.sport,
          league: formData.league,
          gameDescription: formData.gameDescription,
          betType: formData.betType,
          betSide: formData.betSide,
          odds: parseInt(formData.odds),
          stake: parseFloat(formData.stake),
          book: formData.book,
          gameTime: formData.gameTime || null,
          notes: formData.notes || null,
          conversationId: conversationId || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to log bet')
      }

      onSuccess()
    } catch (err) {
      setError('Failed to log bet. Please try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSportChange = (sport: string) => {
    const sportOption = SPORT_OPTIONS.find((s) => s.value === sport)
    setFormData({
      ...formData,
      sport,
      league: sportOption?.league || '',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-[#2f343c] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-[#2f343c] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-accent-emerald">Log New Bet</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-accent-green transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-warning-red/20 border border-warning-red text-warning-red p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Sport */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Sport *
            </label>
            <select
              value={formData.sport}
              onChange={(e) => handleSportChange(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select a sport</option>
              {SPORT_OPTIONS.map((sport) => (
                <option key={sport.value} value={sport.value}>
                  {sport.label}
                </option>
              ))}
            </select>
          </div>

          {/* Game Description */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Game *
            </label>
            <input
              type="text"
              value={formData.gameDescription}
              onChange={(e) => setFormData({ ...formData, gameDescription: e.target.value })}
              placeholder="e.g., Lakers vs Warriors"
              className="input-field"
              required
            />
          </div>

          {/* Bet Type */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Bet Type *
            </label>
            <select
              value={formData.betType}
              onChange={(e) => setFormData({ ...formData, betType: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select bet type</option>
              {BET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bet Side */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Bet Selection *
            </label>
            <input
              type="text"
              value={formData.betSide}
              onChange={(e) => setFormData({ ...formData, betSide: e.target.value })}
              placeholder="e.g., Lakers -5.5, Over 223.5"
              className="input-field"
              required
            />
          </div>

          {/* Odds and Stake */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Odds (American) *
              </label>
              <input
                type="number"
                value={formData.odds}
                onChange={(e) => setFormData({ ...formData, odds: e.target.value })}
                placeholder="-110"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Stake ($) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.stake}
                onChange={(e) => setFormData({ ...formData, stake: e.target.value })}
                placeholder="100.00"
                className="input-field"
                required
              />
            </div>
          </div>

          {/* Book */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Sportsbook *
            </label>
            <select
              value={formData.book}
              onChange={(e) => setFormData({ ...formData, book: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select sportsbook</option>
              {BOOKMAKERS.map((book) => (
                <option key={book} value={book}>
                  {book}
                </option>
              ))}
            </select>
          </div>

          {/* Game Time (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Game Time (Optional)
            </label>
            <input
              type="datetime-local"
              value={formData.gameTime}
              onChange={(e) => setFormData({ ...formData, gameTime: e.target.value })}
              className="input-field"
            />
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              className="input-field resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Logging...' : 'Log Bet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
