import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function getFileExtension(filename: string) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() : 'bin'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'image file is required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image file is too large' }, { status: 400 })
    }

    const extension = getFileExtension(file.name) ?? 'bin'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
    const bucketName = 'chat-images'

    const supabase = createClient()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage.from(bucketName).upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      throw error
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filename)

    return NextResponse.json({ imageUrl: publicUrlData.publicUrl })
  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
