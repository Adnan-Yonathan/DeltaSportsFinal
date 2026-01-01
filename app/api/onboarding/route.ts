import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface OnboardingData {
  favorite_sports: string[]
  preferred_markets: string[]
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  signup_reasons: string[]
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
      !body.favorite_sports ||
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

    // Validate arrays have at least one item
    if (body.favorite_sports.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one sport' },
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

    // Update user profile with onboarding data
    const updateResult = await supabase
      .from('users')
      .update({
        favorite_sports: body.favorite_sports,
        preferred_markets: body.preferred_markets,
        experience_level: body.experience_level,
        risk_tolerance: body.risk_tolerance,
        signup_reasons: body.signup_reasons,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    const metadataUpdate = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        onboarding_profile: {
          favorite_sports: body.favorite_sports,
          preferred_markets: body.preferred_markets,
          experience_level: body.experience_level,
          risk_tolerance: body.risk_tolerance,
          signup_reasons: body.signup_reasons,
        },
      },
    })

    if (updateResult.error) {
      console.error('Error saving onboarding data:', updateResult.error)
      if (metadataUpdate.error) {
        console.error('Error saving onboarding metadata:', metadataUpdate.error)
        return NextResponse.json(
          { error: 'Failed to save onboarding data' },
          { status: 500 }
        )
      }
      return NextResponse.json({
        success: true,
        data: { fallback: true },
      })
    }

    if (metadataUpdate.error) {
      console.warn('Onboarding metadata update failed:', metadataUpdate.error)
    }

    return NextResponse.json({
      success: true,
      data: updateResult.data
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
