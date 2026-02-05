import type { FeedItem, StreamEvent, DbMessage, ToolCall } from '~/types'

export function useChat() {
  const feedItems = ref<FeedItem[]>([])
  const isStreaming = ref(false)
  const currentSessionId = ref<string | null>(null)
  const currentSystemPrompt = ref<string | null>(null)

  async function createSession(systemPrompt?: string): Promise<string> {
    const session = await $fetch('/api/sessions', {
      method: 'POST',
      body: { systemPrompt: systemPrompt || null },
    })
    currentSessionId.value = session.id
    currentSystemPrompt.value = session.systemPrompt || null
    feedItems.value = []
    return session.id
  }

  async function loadSession(sessionId: string) {
    const session = await $fetch(`/api/sessions/${sessionId}`)
    currentSessionId.value = session.id
    currentSystemPrompt.value = (session as any).systemPrompt || null

    // Rebuild feed from stored messages
    const items: FeedItem[] = []
    for (const msg of (session.messages || [])) {
      if (msg.feedItems?.length) {
        items.push(...msg.feedItems)
      } else {
        // Backward compat: old messages without feedItems
        if (msg.role === 'user') {
          items.push({ type: 'user', content: msg.content, timestamp: msg.createdAt })
        } else {
          items.push({ type: 'text', content: msg.content, timestamp: msg.createdAt })
          for (const tc of (msg.toolCalls || [])) {
            items.push({
              type: 'tool_call',
              tool: tc.name,
              input: tc.input,
              summary: tc.name,
              category: 'other',
              timestamp: msg.createdAt,
            })
            if (tc.output !== undefined) {
              items.push({
                type: 'tool_result',
                tool: tc.name,
                output: typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output),
                timestamp: msg.createdAt,
              })
            }
          }
        }
      }
    }
    feedItems.value = items
  }

  async function updateSystemPrompt(prompt: string | null) {
    if (!currentSessionId.value) return
    await $fetch(`/api/sessions/${currentSessionId.value}`, {
      method: 'PATCH',
      body: { systemPrompt: prompt },
    })
    currentSystemPrompt.value = prompt
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isStreaming.value) return

    let sessionId = currentSessionId.value
    if (!sessionId) {
      sessionId = await createSession()
    }

    // Add user message to feed
    feedItems.value.push({
      type: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    })

    isStreaming.value = true

    // Track active tool calls (pending result)
    const pendingTools: { name: string; feedIndex: number }[] = []

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentTextIndex: number | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: StreamEvent = JSON.parse(line)
            processEvent(event)
          } catch {
            // skip malformed
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event: StreamEvent = JSON.parse(buffer)
          processEvent(event)
        } catch {
          // skip
        }
      }

      function processEvent(event: StreamEvent) {
        const now = new Date().toISOString()
        switch (event.type) {
          case 'text':
            // Append to current text item or create new one
            if (currentTextIndex !== null && feedItems.value[currentTextIndex]?.type === 'text') {
              feedItems.value[currentTextIndex] = {
                ...feedItems.value[currentTextIndex],
                content: (feedItems.value[currentTextIndex].content || '') + (event.content || ''),
              }
            } else {
              currentTextIndex = feedItems.value.length
              feedItems.value.push({
                type: 'text',
                content: event.content || '',
                timestamp: now,
              })
            }
            break

          case 'tool_call':
            currentTextIndex = null
            pendingTools.push({ name: event.tool || 'unknown', feedIndex: feedItems.value.length })
            feedItems.value.push({
              type: 'tool_call',
              tool: event.tool || 'unknown',
              input: (event.input as Record<string, unknown>) || {},
              summary: event.summary || event.tool || 'unknown',
              category: (event.category as FeedItem['category']) || 'other',
              timestamp: now,
            })
            break

          case 'tool_result': {
            currentTextIndex = null
            feedItems.value.push({
              type: 'tool_result',
              tool: event.tool || 'unknown',
              output: event.output || '',
              isError: event.isError,
              timestamp: now,
            })
            // Remove from pending
            const idx = pendingTools.findIndex((t) => t.name === event.tool)
            if (idx !== -1) pendingTools.splice(idx, 1)
            break
          }

          case 'result':
            currentTextIndex = null
            feedItems.value.push({
              type: 'result',
              cost: event.cost,
              duration: event.duration,
              timestamp: now,
            })
            break

          case 'error':
            currentTextIndex = null
            feedItems.value.push({
              type: 'error',
              content: event.message || 'Unknown error',
              timestamp: now,
            })
            break
        }
      }
    } catch (err) {
      feedItems.value.push({
        type: 'error',
        content: String(err),
        timestamp: new Date().toISOString(),
      })
    } finally {
      isStreaming.value = false
    }
  }

  return {
    feedItems,
    isStreaming,
    currentSessionId,
    currentSystemPrompt,
    createSession,
    loadSession,
    sendMessage,
    updateSystemPrompt,
  }
}
