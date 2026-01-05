import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

type ScriptArgs = {
  email?: string
  password?: string
}

const parseArgs = (): ScriptArgs => {
  const args = process.argv.slice(2)
  const parsed: ScriptArgs = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--email' && args[i + 1]) {
      parsed.email = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--password' && args[i + 1]) {
      parsed.password = args[i + 1]
      i += 1
    }
  }
  return parsed
}

const buildDefaultEmail = () => `delta.test+${Date.now()}@example.com`
const buildDefaultPassword = () =>
  `DeltaTest!${Math.floor(1000 + Math.random() * 9000)}`

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTestUser() {
  const args = parseArgs()
  const email = args.email || process.env.TEST_USER_EMAIL || buildDefaultEmail()
  const password =
    args.password || process.env.TEST_USER_PASSWORD || buildDefaultPassword()

  console.log('Creating test user...')

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    console.error('Failed to create test user:', error?.message || 'Unknown error')
    process.exit(1)
  }

  const userId = data.user.id

  const { error: profileError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        display_name: email.split('@')[0],
        onboarding_completed: false,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.warn('Warning: could not upsert users profile:', profileError.message)
  }

  console.log('Test user created:')
  console.log(`  Email: ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`  User ID: ${userId}`)
  console.log('Use these credentials to sign in and test onboarding.')
}

createTestUser().catch((error) => {
  console.error('Test user creation failed:', error)
  process.exit(1)
})
