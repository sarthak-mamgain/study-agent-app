import { createGroq } from '@ai-sdk/groq'
import { streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase'

type ChatRequestBody = {
  userMessage?: string
  subject?: string
  concept?: string
  chatId?: string
  imageUrl?: string
}

function buildModePrompt(conceptRow: Record<string, unknown> | null, subject: string, concept: string) {
  const normalizedSubject = subject.trim()
  const normalizedConcept = concept.trim()
  const contextParts: string[] = []

  if (!conceptRow) {
    contextParts.push(
      'Mode A: You are tutoring a beginner. Start with a simple analogy, define key terms clearly, and avoid assuming prior knowledge.',
    )
  } else {
    const masteryLevel = typeof conceptRow.mastery_level === 'string' ? conceptRow.mastery_level : ''
    const masteryScore = typeof conceptRow.mastery_score === 'number' ? conceptRow.mastery_score : null

    if (masteryLevel === 'Introduced' || masteryLevel === 'Developing' || (masteryScore !== null && masteryScore < 0.7)) {
      contextParts.push(
        'Mode B: Reference prior knowledge, mention likely weak areas, and keep a moderate pace with some reinforcement.',
      )
    } else {
      contextParts.push(
        'Mode C: Assume strong familiarity, skip basic definitions, and focus on nuance, tradeoffs, and deeper insight.',
      )
    }
  }

  const weakAreas = normalizeAreas((conceptRow as Record<string, unknown> | null)?.weak_areas)
  const strongAreas = normalizeAreas((conceptRow as Record<string, unknown> | null)?.strong_areas)

  if (weakAreas.length > 0) {
    contextParts.push(`Weak areas to mention gently: ${weakAreas.join(', ')}.`)
  }

  if (strongAreas.length > 0) {
    contextParts.push(`Strong areas to build on: ${strongAreas.join(', ')}.`)
  }

  if (normalizedSubject || normalizedConcept) {
    const topicLabel = [normalizedSubject, normalizedConcept].filter(Boolean).join(' / ')
    contextParts.push(`Current topic: ${topicLabel}.`)
  }

  contextParts.push('Be encouraging, clear, and concise. Answer as a tutor, not as a chatbot.')

  return contextParts.join('\n')
}

function normalizeAreas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  return []
}

function makeTitleFromMessage(message: string) {
  const words = message
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)

  return words.join(' ') || 'New chat'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody
    const userMessage = body.userMessage?.trim() ?? ''
    const subject = body.subject?.trim() ?? ''
    const concept = body.concept?.trim() ?? ''
    const chatId = body.chatId?.trim() ?? ''
    const imageUrl = body.imageUrl?.trim() ?? ''

    if (!userMessage || !chatId) {
      return NextResponse.json({ error: 'userMessage and chatId are required' }, { status: 400 })
    }

    const supabase = createClient()

    let conceptRow: Record<string, unknown> | null = null
    if (subject && concept) {
      const { data, error } = await supabase
        .from('concepts')
        .select('subject, concept')
        .eq('subject', subject)
        .eq('concept', concept)
        .maybeSingle()

      if (!error && data) {
        conceptRow = data as Record<string, unknown>
      }
    }

    const systemPrompt = buildModePrompt(conceptRow, subject, concept)

    const { data: existingChat, error: chatLookupError } = await supabase
      .from('chats')
      .select('id, title')
      .eq('id', chatId)
      .maybeSingle()

    if (chatLookupError) {
      throw chatLookupError
    }

    let chat = existingChat
    if (!chat) {
      const { data: createdChat, error: createChatError } = await supabase
        .from('chats')
        .insert({ id: chatId, title: null })
        .select('id, title')
        .single()

      if (createChatError) {
        throw createChatError
      }

      chat = createdChat
    }

    const { count: existingMessageCount, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)

    if (countError) {
      throw countError
    }

    const isFirstExchange = (existingMessageCount ?? 0) === 0

    const { error: userMessageError } = await supabase.from('messages').insert({
      chat_id: chatId,
      role: 'user',
      content: userMessage,
      image_url: imageUrl || null,
    })

    if (userMessageError) {
      throw userMessageError
    }

    if (!chat.title && isFirstExchange) {
      const generatedTitle = makeTitleFromMessage(userMessage)
      const { error: titleError } = await supabase
        .from('chats')
        .update({ title: generatedTitle })
        .eq('id', chatId)

      if (titleError) {
        throw titleError
      }
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    const model = imageUrl
      ? groq('meta-llama/llama-4-scout-17b-16e-instruct')
      : groq('openai/gpt-oss-120b')

    const promptMessages = [
      {
        role: 'user' as const,
        content: imageUrl
          ? [
              { type: 'text' as const, text: userMessage },
              { type: 'image' as const, image: new URL(imageUrl) },
            ]
          : userMessage,
      },
    ]

    const result = streamText({
      model,
      system: systemPrompt,
      messages: promptMessages,
    })

    const encoder = new TextEncoder()
    let assistantText = ''

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            assistantText += chunk
            controller.enqueue(encoder.encode(chunk))
          }

          controller.close()

          await supabase.from('messages').insert({
            chat_id: chatId,
            role: 'assistant',
            content: assistantText,
          })
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 },
    )
  }
}
