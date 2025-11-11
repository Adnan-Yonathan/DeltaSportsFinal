import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/lib/supabase/types'
import {
  CustomModelConfigPayload,
  CustomModelStatConfig,
  CustomModelStatInput,
} from './custom-model-types'
import { normalizeConfidence, normalizeStatWeights } from './model-utils'

export type TypedSupabaseClient = SupabaseClient<Database>
export {
  type CustomModelStatInput,
  type CustomModelStatConfig,
  type CustomModelConfigPayload,
} from './custom-model-types'

export interface SaveCustomModelInput {
  modelName: string
  sportKey: string
  marketType: string
  targetMetric: string
  confidenceLevel: number
  stats: CustomModelStatInput[]
  dataHints?: string
  notes?: string
}

export async function saveCustomModel(
  supabase: TypedSupabaseClient,
  userId: string,
  payload: SaveCustomModelInput
) {
  const stats = normalizeStatWeights(payload.stats)
  const config: CustomModelConfigPayload = {
    stats,
    dataHints: payload.dataHints,
    confidence: normalizeConfidence(payload.confidenceLevel),
  }

  const { data, error } = await supabase
    .from('custom_models')
    .upsert(
      {
        user_id: userId,
        model_name: payload.modelName.trim(),
        sport_key: payload.sportKey,
        market_type: payload.marketType,
        target_metric: payload.targetMetric,
        confidence_level: normalizeConfidence(payload.confidenceLevel),
        config: config as unknown as Json,
        notes: payload.notes ?? null,
      },
      { onConflict: 'user_id,model_name' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save custom model: ${error.message}`)
  }

  return data
}

export async function listCustomModels(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 5
) {
  const { data, error } = await supabase
    .from('custom_models')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list custom models: ${error.message}`)
  }

  return data || []
}

export async function getCustomModelByName(
  supabase: TypedSupabaseClient,
  userId: string,
  modelName: string
) {
  const { data, error } = await supabase
    .from('custom_models')
    .select('*')
    .eq('user_id', userId)
    .ilike('model_name', modelName)
    .single()

  if (error) {
    throw new Error(`Failed to fetch model "${modelName}": ${error.message}`)
  }

  return data
}

export async function touchCustomModelUsage(
  supabase: TypedSupabaseClient,
  modelId: string
) {
  const { error } = await supabase
    .from('custom_models')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', modelId)

  if (error) {
    throw new Error(`Failed to update model usage: ${error.message}`)
  }
}
