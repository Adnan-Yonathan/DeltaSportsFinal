import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface OnboardingData {
  username: string
  favorite_sports: string[]
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'professional'
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  starting_bankroll: number
  unit_size: number
  signup_reasons: string[]
  subscription_tier?: 'pro' | 'unlimited' | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: OnboardingData = await request.json()

    // Validate required fields
    if (!body.username || !body.favorite_sports || !body.experience_level ||
        !body.risk_tolerance || !body.signup_reasons ||
        body.starting_bankroll === undefined || body.unit_size === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate bankroll and unit size
    if (body.starting_bankroll <= 0) {
      return NextResponse.json(
        { error: 'Starting bankroll must be greater than 0' },
        { status: 400 }
      )
    }

    if (body.unit_size <= 0) {
      return NextResponse.json(
        { error: 'Unit size must be greater than 0' },
        { status: 400 }
      )
    }

    if (body.unit_size > body.starting_bankroll) {
      return NextResponse.json(
        { error: 'Unit size cannot be larger than starting bankroll' },
        { status: 400 }
      )
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(body.username)) {
      return NextResponse.json(
        { error: 'Invalid username format' },
        { status: 400 }
      )
    }

    // Validate arrays have at least one item
    if (body.favorite_sports.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one sport' },
        { status: 400 }
      )
    }

    if (body.signup_reasons.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one feature' },
        { status: 400 }
      )
    }

    // Validate enum values
    const validExperienceLevels = ['beginner', 'intermediate', 'advanced', 'professional']
    if (!validExperienceLevels.includes(body.experience_level)) {
      return NextResponse.json(
        { error: 'Invalid experience level' },
        { status: 400 }
      )
    }

    const validRiskTolerances = ['conservative', 'moderate', 'aggressive']
    if (!validRiskTolerances.includes(body.risk_tolerance)) {
      return NextResponse.json(
        { error: 'Invalid risk tolerance' },
        { status: 400 }
      )
    }

    // Update user profile with onboarding data
    const { data, error } = await supabase
      .from('users')
      .update({
        username: body.username,
        favorite_sports: body.favorite_sports,
        experience_level: body.experience_level,
        risk_tolerance: body.risk_tolerance,
        starting_bankroll: body.starting_bankroll,
        current_bankroll: body.starting_bankroll,
        unit_size: body.unit_size,
        signup_reasons: body.signup_reasons,
        subscription_tier: body.subscription_tier || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation on username
      if (error.code === '23505' && error.message.includes('username')) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        )
      }

      console.error('Error saving onboarding data:', error)
      return NextResponse.json(
        { error: 'Failed to save onboarding data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
