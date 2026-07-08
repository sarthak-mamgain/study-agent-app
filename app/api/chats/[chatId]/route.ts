import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase'

type UpdateChatRequestBody = {
  title?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params
    const body = (await request.json()) as UpdateChatRequestBody
    const title = body.title?.trim() ?? ''

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('chats')
      .update({ title })
      .eq('id', chatId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rename chat error:', error)
    return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase.from('chats').delete().eq('id', chatId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete chat error:', error)
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}
