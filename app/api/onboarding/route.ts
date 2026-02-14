import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface OnboardingData {
  favorite_sports?: string[]
  preferred_markets: string[]
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  signup_reasons: string[]
  bankroll?: number
  unit_size?: number
  bets_per_day?: number
  primary_intent?: string
  bet_frequency?: string
  research_style?: string
  bet_focus?: string
  skill_level?: string
  tailing_experience?: string
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
    if (
      !body.preferred_markets ||
      !body.experience_level ||
      !body.risk_tolerance ||
      !body.signup_reasons
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (body.signup_reasons.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one goal' },
        { status: 400 }
      )
    }

    if (body.preferred_markets.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one market' },
        { status: 400 }
      )
    }

    // Validate enum values
    const validExperienceLevels = ['beginner', 'intermediate', 'advanced']
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

    // Update user profile with onboarding data.
    // Keep this payload aligned with columns that exist in public.users.
    // Rich profile details are still preserved in auth metadata below.
    const updateData: Record<string, unknown> = {
      ...(body.favorite_sports && body.favorite_sports.length > 0
        ? { favorite_sports: body.favorite_sports }
        : {}),
      experience_level: body.experience_level,
      risk_tolerance: body.risk_tolerance,
      signup_reasons: body.signup_reasons,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    }

    // Add bankroll if provided
    if (body.bankroll && body.bankroll > 0) {
      updateData.bankroll = body.bankroll
    }

    if (body.unit_size && body.unit_size > 0) {
      updateData.unit_size = body.unit_size
    }
    const updateResult = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('id')
      .single()

    const metadataUpdate = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        onboarding_profile: {
          ...(body.favorite_sports && body.favorite_sports.length > 0
            ? { favorite_sports: body.favorite_sports }
            : {}),
          primary_intent: body.primary_intent,
          bet_frequency: body.bet_frequency,
          research_style: body.research_style,
          bet_focus: body.bet_focus,
          skill_level: body.skill_level,
          tailing_experience: body.tailing_experience,
          preferred_markets: body.preferred_markets,
          experience_level: body.experience_level,
          risk_tolerance: body.risk_tolerance,
          signup_reasons: body.signup_reasons,
          bankroll: body.bankroll || 0,
          unit_size: body.unit_size || 0,
          bets_per_day: body.bets_per_day || 0,
        },
      },
    })

    if (updateResult.error) {
      console.error('Error saving onboarding profile row:', updateResult.error)
      if (metadataUpdate.error) {
        console.error('Error saving onboarding metadata:', metadataUpdate.error)
        return NextResponse.json(
          { error: 'Failed to save onboarding data' },
          { status: 500 }
        )
      }
      return NextResponse.json({
        success: true,
        data: { profile_updated: false, metadata_updated: true },
      })
    }

    if (metadataUpdate.error) {
      console.warn('Onboarding metadata update failed:', metadataUpdate.error)
    }

    return NextResponse.json({
      success: true,
      data: {
        profile_updated: true,
        metadata_updated: !metadataUpdate.error,
      }
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
