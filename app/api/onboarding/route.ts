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
    const validExperienceLevels = ['beginner', 'intermediate', 'advanced']
    const validRiskTolerances = ['conservative', 'moderate', 'aggressive']
    const preferredMarketsInput = Array.isArray(body.preferred_markets)
      ? body.preferred_markets.filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      : []
    const signupReasonsInput = Array.isArray(body.signup_reasons)
      ? body.signup_reasons.filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      : []
    const preferredMarkets = preferredMarketsInput.length > 0
      ? preferredMarketsInput
      : ['spreads']
    const signupReasons = signupReasonsInput.length > 0
      ? signupReasonsInput
      : ['get-started']
    const experienceLevel = validExperienceLevels.includes(body.experience_level || '')
      ? body.experience_level
      : 'beginner'
    const riskTolerance = validRiskTolerances.includes(body.risk_tolerance || '')
      ? body.risk_tolerance
      : 'moderate'

    // Update user profile with onboarding data.
    // Keep this payload aligned with columns that exist in public.users.
    // Rich profile details are still preserved in auth metadata below.
    const updateData: Record<string, unknown> = {
      ...(body.favorite_sports && body.favorite_sports.length > 0
        ? { favorite_sports: body.favorite_sports }
        : {}),
      experience_level: experienceLevel,
      risk_tolerance: riskTolerance,
      signup_reasons: signupReasons,
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
          preferred_markets: preferredMarkets,
          experience_level: experienceLevel,
          risk_tolerance: riskTolerance,
          signup_reasons: signupReasons,
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
