// Script to reset a user's bankroll dashboard
// Usage: node scripts/reset-bankroll.js <user-email>

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    envVars[key] = value
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetBankroll(userEmail) {
  try {
    console.log(`\nResetting bankroll for: ${userEmail}`)

    // 1. Get user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
      console.error('Error fetching users:', userError)
      return
    }

    const user = userData.users.find(u => u.email === userEmail)

    if (!user) {
      console.error(`User not found: ${userEmail}`)
      return
    }

    console.log(`Found user: ${user.id}`)

    // 2. Get current bet count
    const { count: betCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    console.log(`Current bets: ${betCount}`)

    // 3. Delete all bets
    const { error: betsError } = await supabase
      .from('bets')
      .delete()
      .eq('user_id', user.id)

    if (betsError) {
      console.error('Error deleting bets:', betsError)
      return
    }

    console.log(`✓ Deleted ${betCount} bets`)

    // 4. Delete all bankroll snapshots
    const { error: snapshotsError } = await supabase
      .from('bankroll_snapshots')
      .delete()
      .eq('user_id', user.id)

    if (snapshotsError) {
      console.error('Error deleting snapshots:', snapshotsError)
      return
    }

    console.log('✓ Deleted all bankroll snapshots')

    // 5. Reset current_bankroll to starting_bankroll (or default to 1000)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('starting_bankroll')
      .eq('id', user.id)
      .single()

    const resetAmount = userProfile?.starting_bankroll || 1000

    const { error: updateError } = await supabase
      .from('users')
      .update({ current_bankroll: resetAmount })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error resetting bankroll:', updateError)
      return
    }

    console.log(`✓ Reset current_bankroll to $${resetAmount}`)
    console.log('\n✅ Bankroll dashboard reset successfully!\n')

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Get email from command line argument
const userEmail = process.argv[2]

if (!userEmail) {
  console.error('Usage: node scripts/reset-bankroll.js <user-email>')
  process.exit(1)
}

// Run the reset
resetBankroll(userEmail)
