import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

type DetectConceptRequestBody = {
  userMessage?: string
}

type DetectConceptResponse = {
  subject: string
  concept: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetectConceptRequestBody
    const userMessage = body.userMessage?.trim() ?? ''

    if (!userMessage) {
      return NextResponse.json<DetectConceptResponse>({ subject: '', concept: '' })
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: [
        'You extract the study topic from a user message.',
        'Return ONLY valid JSON with this shape: {"subject":"","concept":""}.',
        'If the message is not about studying a concept, return empty strings.',
        'Examples:',
        '{"subject":"Math","concept":"Fractions"}',
        '{"subject":"Biology","concept":"Photosynthesis"}',
        '{"subject":"","concept":""}',
      ].join(' '),
      prompt: userMessage,
    })

    let parsed: DetectConceptResponse = { subject: '', concept: '' }

    try {
      parsed = JSON.parse(text) as DetectConceptResponse
    } catch {
      const fallback = text.match(/subject\s*:\s*"?([^"\n,}]+)"?/i)
      const conceptMatch = text.match(/concept\s*:\s*"?([^"\n,}]+)"?/i)

      parsed = {
        subject: fallback?.[1]?.trim() ?? '',
        concept: conceptMatch?.[1]?.trim() ?? '',
      }
    }

    return NextResponse.json<DetectConceptResponse>({
      subject: parsed.subject ?? '',
      concept: parsed.concept ?? '',
    })
  } catch (error) {
    console.error('Detect concept route error:', error)
    return NextResponse.json<DetectConceptResponse>({ subject: '', concept: '' })
  }
}
