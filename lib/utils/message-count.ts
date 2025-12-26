import type { SupabaseClient } from '@supabase/supabase-js'

export const PRO_DAILY_MESSAGE_LIMIT = 25

/**
 * Count messages sent by a user today (UTC)
 */
export async function countUserMessagesToday(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)

  if (convError || !conversations?.length) {
    return 0
  }

  const conversationIds = conversations.map((conv: any) => conv.id)
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .eq('role', 'user')
    .gte('created_at', startOfDay.toISOString())

  return count ?? 0
}

/**
 * Count total messages sent by a user (all time)
 */
export async function countUserMessagesTotal(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)

  if (convError || !conversations?.length) {
    return 0
  }

  const conversationIds = conversations.map((conv: any) => conv.id)
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .eq('role', 'user')

  return count ?? 0
}
