import { createClient } from '@/lib/supabase'

import { DashboardClient } from './dashboard-client'

type ConceptRow = {
  id: string
  subject: string
  concept: string
  mastery_score: number | null
  mastery_level: string | null
  overview_gist: string | null
  deep_dive_gist: string[] | null
  strong_areas: string[] | null
  weak_areas: string[] | null
  next_steps: string[] | null
  notes: string | null
  updated_at: string | null
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data, error } = await supabase.from('concepts').select('*')

  const concepts = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: (row.id as string) ?? '',
    subject: (row.subject as string) ?? '',
    concept: (row.concept as string) ?? '',
    mastery_score: null,
    mastery_level: null,
    overview_gist: null,
    deep_dive_gist: null,
    strong_areas: null,
    weak_areas: null,
    next_steps: null,
    notes: null,
    updated_at: null,
  })) as ConceptRow[]

  if (error) {
    console.error(error)
  }

  return <DashboardClient concepts={concepts} />
}
