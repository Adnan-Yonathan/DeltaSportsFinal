/**
 * CRUD operations for research models
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResearchModelConfig,
  ResearchFilter,
  ResearchSortConfig,
  SaveResearchModelInput,
} from './research-model-types'

export interface ResearchModelRow {
  id: string
  user_id: string
  model_name: string
  model_type: 'research'
  research_config: ResearchModelConfig
  notes?: string
  created_at: string
  updated_at: string
  last_used_at?: string
}

/**
 * Save or update a research model
 */
export async function save_research_model(
  supabase: SupabaseClient,
  userId: string,
  input: SaveResearchModelInput
): Promise<ResearchModelRow> {
  const config: ResearchModelConfig = {
    searchScope: {
      sports: input.sports,
      markets: input.markets,
      propTypes: [],
      books: [],
    },
    filters: input.filters,
    sortBy: input.sortBy,
    maxResults: input.maxResults || 20,
  }

  const payload = {
    user_id: userId,
    model_name: input.modelName,
    model_type: 'research' as const,
    sport_key: input.sports[0] || 'basketball_nba', // Primary sport for compatibility
    market_type: input.markets[0] || 'spreads', // Primary market for compatibility
    target_metric: 'opportunities', // Research models target opportunities, not specific metrics
    research_config: config,
    notes: input.notes,
  }

  // Upsert: Insert or update if model_name already exists for this user
  const { data, error } = await supabase
    .from('custom_models')
    .upsert(payload, {
      onConflict: 'user_id,model_name',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save research model: ${error.message}`)
  }

  return data as ResearchModelRow
}

/**
 * List all research models for a user
 */
export async function list_research_models(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 10
): Promise<ResearchModelRow[]> {
  const { data, error } = await supabase
    .from('custom_models')
    .select('*')
    .eq('user_id', userId)
    .eq('model_type', 'research')
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list research models: ${error.message}`)
  }

  return (data || []) as ResearchModelRow[]
}

/**
 * Get a specific research model by ID
 */
export async function get_research_model(
  supabase: SupabaseClient,
  userId: string,
  modelId: string
): Promise<ResearchModelRow> {
  const { data, error } = await supabase
    .from('custom_models')
    .select('*')
    .eq('id', modelId)
    .eq('user_id', userId)
    .eq('model_type', 'research')
    .single()

  if (error || !data) {
    throw new Error('Research model not found')
  }

  return data as ResearchModelRow
}

/**
 * Get a research model by name (case-insensitive)
 */
export async function get_research_model_by_name(
  supabase: SupabaseClient,
  userId: string,
  modelName: string
): Promise<ResearchModelRow> {
  const { data, error } = await supabase
    .from('custom_models')
    .select('*')
    .eq('user_id', userId)
    .eq('model_type', 'research')
    .ilike('model_name', modelName)
    .single()

  if (error || !data) {
    throw new Error(`Research model "${modelName}" not found`)
  }

  return data as ResearchModelRow
}

/**
 * Delete a research model
 */
export async function delete_research_model(
  supabase: SupabaseClient,
  userId: string,
  modelId: string
): Promise<void> {
  const { error } = await supabase
    .from('custom_models')
    .delete()
    .eq('id', modelId)
    .eq('user_id', userId)
    .eq('model_type', 'research')

  if (error) {
    throw new Error(`Failed to delete research model: ${error.message}`)
  }
}

/**
 * Update last_used_at timestamp for a research model
 */
export async function touch_research_model_usage(
  supabase: SupabaseClient,
  modelId: string
): Promise<void> {
  const { error } = await supabase
    .from('custom_models')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', modelId)

  if (error) {
    console.error('[RESEARCH] Failed to update last_used_at:', error.message)
  }
}
