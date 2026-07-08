'use client'

import { useEffect, useRef, useState } from 'react'

import { TopNav } from './components/top-nav'

type Chat = {
  id: string
  title: string | null
  created_at: string
}

type Message = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  image_url?: string | null
  created_at?: string
  pendingSave?: {
    subject: string
    concept: string
    responseText: string
    saved?: boolean
  }
}

type SaveConceptPayload = {
  subject: string
  concept: string
  masteryLevel?: string
  overviewGist?: string
  deepDiveGist?: string[]
  strongAreas?: string[]
  weakAreas?: string[]
  nextSteps?: string[]
  notes?: string
}

function formatRelativeDate(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(value).toLocaleDateString()
}

function buildSavePayload(subject: string, concept: string, responseText: string): SaveConceptPayload {
  const lines = responseText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const overviewGist = lines[0] ?? responseText.slice(0, 180)
  const deepDiveGist = lines.slice(1, 3)
  const strongAreas = lines.filter((line) => /strong|good|already/i.test(line)).slice(0, 3)
  const weakAreas = lines.filter((line) => /weak|hard|tricky|review/i.test(line)).slice(0, 3)
  const nextSteps = lines.filter((line) => /next|practice|review|try/i.test(line)).slice(0, 3)

  return {
    subject,
    concept,
    masteryLevel: 'Developing',
    overviewGist,
    deepDiveGist: deepDiveGist.length > 0 ? deepDiveGist : [responseText.slice(0, 180)],
    strongAreas: strongAreas.length > 0 ? strongAreas : ['Core idea'],
    weakAreas: weakAreas.length > 0 ? weakAreas : ['Review basics'],
    nextSteps: nextSteps.length > 0 ? nextSteps : ['Practice with examples'],
    notes: responseText.slice(0, 400),
  }
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    void loadChats()

    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  async function loadChats() {
    try {
      const response = await fetch('/api/chats')
      if (!response.ok) throw new Error('Failed to load chats')
      const data = (await response.json()) as Chat[]
      setChats(data)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadMessages(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`)
      if (!response.ok) throw new Error('Failed to load messages')
      const data = (await response.json()) as Message[]
      setMessages(data)
    } catch (err) {
      console.error(err)
      setMessages([])
    }
  }

  function clearSelectedImage() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setSelectedImageFile(null)
    setSelectedImagePreview(null)
  }

  function handleImagePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setSelectedImageFile(file)
    setSelectedImagePreview(previewUrl)
  }

  async function handleSend() {
    const trimmed = input.trim()
    const hasText = trimmed.length > 0
    const hasImage = Boolean(selectedImageFile)

    if (!hasText && !hasImage) return

    setIsSending(true)
    setError(null)

    try {
      let chatId = activeChatId
      if (!chatId) {
        const createResponse = await fetch('/api/chats', { method: 'POST' })
        if (!createResponse.ok) throw new Error('Failed to create chat')
        const created = (await createResponse.json()) as { id: string }
        chatId = created.id
        setActiveChatId(chatId)
      }

      let uploadedImageUrl: string | undefined
      if (selectedImageFile) {
        const uploadForm = new FormData()
        uploadForm.append('image', selectedImageFile)
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: uploadForm,
        })

        if (!uploadResponse.ok) throw new Error('Failed to upload image')
        const uploadData = (await uploadResponse.json()) as { imageUrl?: string }
        uploadedImageUrl = uploadData.imageUrl
      }

      const messageText = trimmed || 'Sent an image'
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        chat_id: chatId,
        role: 'user',
        content: messageText,
        image_url: uploadedImageUrl ?? null,
        created_at: new Date().toISOString(),
      }

      setMessages((previous) => [...previous, userMessage])

      const detectResponse = await fetch('/api/detect-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: messageText }),
      })

      if (!detectResponse.ok) throw new Error('Failed to detect concept')
      const { subject, concept } = (await detectResponse.json()) as { subject: string; concept: string }

      const assistantMessageId = `temp-assistant-${Date.now()}`
      setMessages((previous) => [
        ...previous,
        {
          id: assistantMessageId,
          chat_id: chatId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          pendingSave: subject && concept ? { subject, concept, responseText: '', saved: false } : undefined,
        },
      ])

      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          subject,
          concept,
          chatId,
          imageUrl: uploadedImageUrl,
        }),
      })

      if (!chatResponse.ok || !chatResponse.body) throw new Error('Failed to send chat message')

      const reader = chatResponse.body.getReader()
      const decoder = new TextDecoder()
      let streamedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        streamedText += chunk
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId ? { ...message, content: streamedText } : message,
          ),
        )
      }

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                pendingSave:
                  subject && concept
                    ? {
                        subject,
                        concept,
                        responseText: streamedText,
                        saved: false,
                      }
                    : undefined,
              }
            : message,
        ),
      )

      await loadChats()
      if (chatId) {
        await loadMessages(chatId)
      }
      setInput('')
      clearSelectedImage()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsSending(false)
    }
  }

  async function handleSaveProgress(message: Message) {
    if (!message.pendingSave) return

    try {
      const payload = buildSavePayload(message.pendingSave.subject, message.pendingSave.concept, message.pendingSave.responseText)
      const response = await fetch('/api/save-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to save progress')

      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id
            ? {
                ...item,
                pendingSave: { ...item.pendingSave!, saved: true },
              }
            : item,
        ),
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to save progress')
    }
  }

  async function handleRenameChat(chatId: string) {
    const nextTitle = window.prompt('Rename chat')
    if (!nextTitle?.trim()) return

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle.trim() }),
      })

      if (!response.ok) throw new Error('Failed to rename chat')
      await loadChats()
      if (activeChatId === chatId) {
        await loadMessages(chatId)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to rename chat')
    }
  }

  async function handleDeleteChat(chatId: string) {
    if (!window.confirm('Delete this chat?')) return

    try {
      const response = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete chat')
      if (activeChatId === chatId) {
        setActiveChatId(null)
        setMessages([])
      }
      await loadChats()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to delete chat')
    }
  }

  function handleNewChat() {
    setActiveChatId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <TopNav />
      <div className="mx-auto flex h-[calc(100vh-73px)] max-w-7xl flex-col overflow-hidden md:flex-row">
        <aside
          className={`$${sidebarOpen ? 'flex' : 'hidden'} w-full flex-col border-r border-white/10 bg-[#0b1120] md:flex md:w-80`}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Study Tutor</p>
              <h1 className="text-lg font-semibold">Chats</h1>
            </div>
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
            >
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {chats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                No chats yet. Start a new one to begin.
              </p>
            ) : (
              <ul className="space-y-2">
                {chats.map((chat) => (
                  <li
                    key={chat.id}
                    className={`group flex items-center justify-between rounded-xl border px-3 py-3 transition ${
                      activeChatId === chat.id
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(chat.id)
                        void loadMessages(chat.id)
                        setSidebarOpen(false)
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{chat.title ?? 'Untitled chat'}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatRelativeDate(chat.created_at)}</p>
                    </button>

                    <div className="ml-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => void handleRenameChat(chat.id)}
                        className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                        aria-label="Rename chat"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChat(chat.id)}
                        className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                        aria-label="Delete chat"
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex flex-1 flex-col bg-[#060b18]">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden"
              >
                ☰
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-400">Study assistant</p>
                <h2 className="text-lg font-semibold">{activeChatId ? 'Active session' : 'Start a new conversation'}</h2>
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                Ask about a concept, upload an image, and the tutor will guide you through it.
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-blue-600/90 text-white' : 'border border-white/10 bg-[#111827] text-slate-200'}`}>
                    {message.image_url ? (
                      <div className="mb-2 overflow-hidden rounded-xl">
                        <img src={message.image_url} alt="Attached upload" className="h-40 w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                    {message.pendingSave ? (
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveProgress(message)}
                          className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          {message.pendingSave.saved ? 'Saved ✓' : 'Save progress'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {error ? <div className="mx-4 mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div> : null}

          <div className="border-t border-white/10 bg-[#060b18] p-4 md:p-6">
            {selectedImagePreview ? (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
                <img src={selectedImagePreview} alt="Selected preview" className="h-16 w-16 rounded-lg object-cover" />
                <p className="flex-1 truncate text-sm text-slate-300">{selectedImageFile?.name}</p>
                <button type="button" onClick={clearSelectedImage} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                  ×
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#0f172a] p-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about a concept or share an image"
                className="min-h-[48px] flex-1 resize-none border-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                rows={1}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImagePick}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"
                aria-label="Attach image"
              >
                📎
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
