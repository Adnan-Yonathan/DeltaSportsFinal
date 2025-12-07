'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileUploadZone } from '@/components/models/FileUploadZone'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewModelPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdModelId, setCreatedModelId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    modelName: '',
    description: '',
    instructions: '',
    sportKey: 'basketball_nba',
    marketType: 'totals',
    targetMetric: 'total_points',
    confidenceLevel: 0.90,
    modelType: 'prediction' as 'prediction' | 'research',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in to create a model')
        setLoading(false)
        return
      }

      // Create minimal model with new fields
      const { data: model, error: modelError } = await supabase
        .from('custom_models')
        .insert({
          user_id: user.id,
          model_name: formData.modelName,
          description: formData.description || null,
          instructions: formData.instructions || null,
          sport_key: formData.sportKey,
          market_type: formData.marketType,
          target_metric: formData.targetMetric,
          confidence_level: formData.confidenceLevel,
          model_type: formData.modelType,
          config: { stats: [] }, // Empty config for now
          file_metadata: [],
        })
        .select()
        .single()

      if (modelError) {
        console.error('Model creation error:', modelError)
        setError(modelError.message)
        setLoading(false)
        return
      }

      setCreatedModelId(model.id)
      // Redirect to model details or chat after creation
      setTimeout(() => {
        router.push(`/chat`)
      }, 1500)
    } catch (err: any) {
      console.error('Error creating model:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/chat"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Chat
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Custom Model
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Build a custom statistical model with your own instructions and data files
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model Name *
                </label>
                <input
                  type="text"
                  value={formData.modelName}
                  onChange={(e) =>
                    setFormData({ ...formData, modelName: e.target.value })
                  }
                  required
                  placeholder="e.g., NBA Pace Model"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Brief description of what this model does..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model Type
                </label>
                <select
                  value={formData.modelType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      modelType: e.target.value as 'prediction' | 'research',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="prediction">Prediction Model (Statistical Scoring)</option>
                  <option value="research">Research Model (Opportunity Scanner)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Custom Instructions Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Custom Instructions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Define how the AI should analyze data and make predictions with this model
            </p>

            <textarea
              value={formData.instructions}
              onChange={(e) =>
                setFormData({ ...formData, instructions: e.target.value })
              }
              rows={6}
              placeholder="Example: When analyzing teams, focus on pace-adjusted efficiency metrics. Prioritize recent performance (last 10 games) over season averages. Consider home/away splits and back-to-back game situations..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Configuration Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Model Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sport
                </label>
                <select
                  value={formData.sportKey}
                  onChange={(e) =>
                    setFormData({ ...formData, sportKey: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="basketball_nba">NBA</option>
                  <option value="basketball_ncaab">NCAA Basketball</option>
                  <option value="americanfootball_nfl">NFL</option>
                  <option value="americanfootball_ncaaf">NCAA Football</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Market Type
                </label>
                <select
                  value={formData.marketType}
                  onChange={(e) =>
                    setFormData({ ...formData, marketType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="totals">Totals (Over/Under)</option>
                  <option value="spreads">Spreads</option>
                  <option value="h2h">Moneyline (H2H)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Metric
                </label>
                <input
                  type="text"
                  value={formData.targetMetric}
                  onChange={(e) =>
                    setFormData({ ...formData, targetMetric: e.target.value })
                  }
                  placeholder="e.g., total_points, spread"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confidence Level
                </label>
                <select
                  value={formData.confidenceLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confidenceLevel: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value={0.8}>80% (Wider range)</option>
                  <option value={0.9}>90% (Balanced)</option>
                  <option value={0.95}>95% (Conservative)</option>
                </select>
              </div>
            </div>
          </div>

          {/* File Upload Card */}
          {createdModelId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Upload Data Files (Optional)
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload CSV, Excel, PDF, or text files with additional data or context
              </p>

              <FileUploadZone modelId={createdModelId} maxFiles={5} />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {createdModelId && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-600 dark:text-green-400">
                ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Model created successfully! You can now upload files or continue to chat.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Link
              href="/chat"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !formData.modelName}
              className="inline-flex items-center px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-md transition-colors disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Creating...' : 'Create Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
