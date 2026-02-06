import { ref } from 'vue'
import {
  createSession,
  sendMessage,
  getSession,
  updateSession,
  type Session,
} from '../api/chat'

export interface FeedItem {
  type: 'user' | 'text' | 'tool_call' | 'tool_result' | 'result' | 'error'
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  summary?: string
  category?: string
  isError?: boolean
  cost?: number
  duration?: number
  timestamp: string
}

export function useChat() {
  const feedItems = ref<FeedItem[]>([])
  const sessionId = ref<string | null>(null)
  const systemPrompt = ref<string | null>(null)
  const isStreaming = ref(false)

  async function createNewSession() {
    const session = await createSession()
    sessionId.value = session.id
    feedItems.value = []
  }

  async function sendUserMessage(prompt: string) {
    isStreaming.value = true

    try {
      // Create session if needed
      if (!sessionId.value) {
        await createNewSession()
      }

      // Add user message to feed
      feedItems.value.push({
        type: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      })

      const reader = await sendMessage(sessionId.value!, prompt)
      await processStream(reader)
    } finally {
      isStreaming.value = false
    }
  }

  async function processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) {
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue

        try {
          const data = JSON.parse(line.slice(6))
          handleStreamEvent(data)
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }
  }

  function handleStreamEvent(event: any) {
    const timestamp = new Date().toISOString()

    switch (event.type) {
      case 'text':
        // Append to last text item or create new
        const lastItem = feedItems.value[feedItems.value.length - 1]
        if (lastItem?.type === 'text') {
          lastItem.content = (lastItem.content || '') + event.content
        } else {
          feedItems.value.push({
            type: 'text',
            content: event.content,
            timestamp,
          })
        }
        break

      case 'tool_call':
        feedItems.value.push({
          type: 'tool_call',
          tool: event.tool,
          input: event.input,
          summary: event.summary,
          category: event.category,
          timestamp,
        })
        break

      case 'tool_result':
        feedItems.value.push({
          type: 'tool_result',
          tool: event.tool,
          output: event.output,
          isError: event.isError,
          timestamp,
        })
        break

      case 'result':
        feedItems.value.push({
          type: 'result',
          cost: event.cost,
          duration: event.duration,
          timestamp,
        })
        break

      case 'error':
        feedItems.value.push({
          type: 'error',
          content: event.message,
          timestamp,
        })
        break
    }
  }

  async function loadSession(id: string) {
    const session = await getSession(id)
    sessionId.value = session.id
    systemPrompt.value = session.systemPrompt || null

    // Rebuild feed from stored messages
    const items: FeedItem[] = []
    for (const msg of session.messages || []) {
      if (msg.feedItems && msg.feedItems.length > 0) {
        items.push(...msg.feedItems)
      }
    }
    feedItems.value = items
  }

  async function updateSystemPrompt(prompt: string | null) {
    if (!sessionId.value) return

    await updateSession(sessionId.value, { systemPrompt: prompt })
    systemPrompt.value = prompt
  }

  function clearSession() {
    sessionId.value = null
    systemPrompt.value = null
    feedItems.value = []
  }

  return {
    feedItems,
    sessionId,
    systemPrompt,
    isStreaming,
    createNewSession,
    sendUserMessage,
    loadSession,
    updateSystemPrompt,
    clearSession,
  }
}
