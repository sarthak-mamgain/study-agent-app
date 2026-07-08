import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase'

type SaveConceptRequestBody = {
  subject?: string
  concept?: string
  masteryLevel?: string
  overviewGist?: string
  deepDiveGist?: string[]
  strongAreas?: string[]
  weakAreas?: string[]
  nextSteps?: string[]
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveConceptRequestBody
    const subject = body.subject?.trim() ?? ''
    const concept = body.concept?.trim() ?? ''

    if (!subject || !concept) {
      return NextResponse.json({ error: 'subject and concept are required' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase.from('concepts').upsert(
      {
        subject,
        concept,
      },
      { onConflict: 'subject,concept' },
    )

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save concept route error:', error)
    return NextResponse.json({ error: 'Failed to save concept' }, { status: 500 })
  }
}
