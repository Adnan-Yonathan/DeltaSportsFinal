'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, FileText, Calendar, TrendingUp, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ModelWithFiles {
  id: string
  model_name: string
  description: string | null
  sport_key: string
  market_type: string
  model_type?: string
  file_metadata?: any[]
  created_at: string
  last_used_at: string | null
  instructions: string | null
}

export default function ModelsPage() {
  const supabase = createClient()
  const [models, setModels] = useState<ModelWithFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'prediction' | 'research'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('custom_models')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading models:', error)
        return
      }

      setModels(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredModels = models.filter((model) => {
    const matchesFilter =
      filter === 'all' || model.model_type === filter || (!model.model_type && filter === 'prediction')
    const matchesSearch = model.model_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                My Models
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your custom statistical and research models
              </p>
            </div>
            <Link
              href="/models/new"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Model
            </Link>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('prediction')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'prediction'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                }`}
              >
                Prediction
              </button>
              <button
                onClick={() => setFilter('research')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'research'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                }`}
              >
                Research
              </button>
            </div>
          </div>
        </div>

        {/* Models Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading models...</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No models found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm
                ? 'Try a different search term'
                : 'Create your first custom model to get started'}
            </p>
            {!searchTerm && (
              <Link
                href="/models/new"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Model
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model) => (
              <Link
                key={model.id}
                href={`/chat`}
                className="group block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 transition-all p-6"
              >
                {/* Model Type Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      model.model_type === 'research'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {model.model_type === 'research' ? 'Research' : 'Prediction'}
                  </span>
                  {model.file_metadata && model.file_metadata.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â½ {model.file_metadata.length} files
                    </span>
                  )}
                </div>

                {/* Model Name */}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {model.model_name}
                </h3>

                {/* Description */}
                {model.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {model.description}
                  </p>
                )}

                {/* Instructions Indicator */}
                {model.instructions && (
                  <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 font-mono">
                      {model.instructions}
                    </p>
                  </div>
                )}

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDistanceToNow(new Date(model.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <span className="capitalize">{model.sport_key.replace('_', ' ')}</span>
                </div>

                {/* Last Used */}
                {model.last_used_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Last used:{' '}
                    {formatDistanceToNow(new Date(model.last_used_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
