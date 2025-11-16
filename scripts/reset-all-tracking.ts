/**
 * Reset All User Tracking Data
 *
 * This script resets all bet tracking data for all users:
 * - Deletes all bets
 * - Deletes all bankroll snapshots
 * - Resets current_bankroll to starting_bankroll
 * - Preserves user profiles and onboarding data
 *
 * USE WITH CAUTION: This is destructive and cannot be undone!
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetAllTracking() {
  console.log('🚨 RESET ALL TRACKING DATA 🚨')
  console.log('================================')
  console.log('')
  console.log('This will:')
  console.log('  ✓ Delete ALL bets for ALL users')
  console.log('  ✓ Delete ALL bankroll snapshots')
  console.log('  ✓ Reset current_bankroll to starting_bankroll')
  console.log('  ✓ Preserve user profiles and settings')
  console.log('')
  console.log('⚠️  THIS ACTION CANNOT BE UNDONE!')
  console.log('')

  // Add a safety check
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ This script is disabled in production for safety.')
    console.error('   Remove this check if you really want to run it in production.')
    process.exit(1)
  }

  try {
    console.log('🔍 Counting current data...')

    // Count existing data
    const { count: betCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })

    const { count: snapshotCount } = await supabase
      .from('bankroll_snapshots')
      .select('*', { count: 'exact', head: true })

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    console.log(`   Found ${betCount} bets`)
    console.log(`   Found ${snapshotCount} bankroll snapshots`)
    console.log(`   Found ${userCount} users`)
    console.log('')

    // Delete all bets
    console.log('🗑️  Deleting all bets...')
    const { error: betsError } = await supabase
      .from('bets')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (betsError) {
      console.error('❌ Error deleting bets:', betsError)
      throw betsError
    }
    console.log('   ✓ All bets deleted')

    // Delete all bankroll snapshots
    console.log('🗑️  Deleting all bankroll snapshots...')
    const { error: snapshotsError } = await supabase
      .from('bankroll_snapshots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (snapshotsError) {
      console.error('❌ Error deleting snapshots:', snapshotsError)
      throw snapshotsError
    }
    console.log('   ✓ All bankroll snapshots deleted')

    // Reset all users' current_bankroll to their starting_bankroll
    console.log('🔄 Resetting bankrolls...')

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, starting_bankroll')

    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      throw usersError
    }

    if (users && users.length > 0) {
      for (const user of users) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            current_bankroll: user.starting_bankroll,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          console.error(`❌ Error updating user ${user.id}:`, updateError)
          throw updateError
        }
      }
      console.log(`   ✓ Reset bankroll for ${users.length} users`)
    }

    console.log('')
    console.log('✅ RESET COMPLETE!')
    console.log('================================')
    console.log(`   Deleted: ${betCount} bets`)
    console.log(`   Deleted: ${snapshotCount} snapshots`)
    console.log(`   Reset: ${users?.length || 0} user bankrolls`)
    console.log('')
    console.log('All users can now start fresh with their onboarding bankroll settings.')

  } catch (error) {
    console.error('')
    console.error('❌ RESET FAILED!')
    console.error('================================')
    console.error(error)
    process.exit(1)
  }
}

// Run the reset
resetAllTracking()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
