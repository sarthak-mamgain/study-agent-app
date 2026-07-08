import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase'

export async function POST() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('chats')
      .insert({ title: null })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error('Create chat error:', error)
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.from('chats').select('id, title')

    if (error) {
      throw error
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('List chats error:', error)
    return NextResponse.json({ error: 'Failed to list chats' }, { status: 500 })
  }
}
