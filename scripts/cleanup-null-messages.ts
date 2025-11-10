/**
 * Database Cleanup Script
 * Removes messages with null or empty content from the database
 *
 * Run this with: npx ts-node scripts/cleanup-null-messages.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupNullMessages() {
  console.log('🔍 Searching for messages with null or empty content...')

  // Find messages with null or empty content
  const { data: nullMessages, error: fetchError } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, created_at')
    .or('content.is.null,content.eq.')

  if (fetchError) {
    console.error('❌ Error fetching messages:', fetchError)
    return
  }

  if (!nullMessages || nullMessages.length === 0) {
    console.log('✅ No null or empty messages found!')
    return
  }

  console.log(`\n📊 Found ${nullMessages.length} messages with null/empty content:`)
  nullMessages.forEach(msg => {
    console.log(`  - ID: ${msg.id}, Role: ${msg.role}, Conversation: ${msg.conversation_id}, Date: ${msg.created_at}`)
  })

  console.log('\n🗑️  Deleting null/empty messages...')

  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .or('content.is.null,content.eq.')

  if (deleteError) {
    console.error('❌ Error deleting messages:', deleteError)
    return
  }

  console.log(`✅ Successfully deleted ${nullMessages.length} null/empty messages!`)
  console.log('\n💡 Your chat should now work properly (once OpenAI credits are added)')
}

cleanupNullMessages()
  .then(() => {
    console.log('\n✨ Cleanup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error)
    process.exit(1)
  })
