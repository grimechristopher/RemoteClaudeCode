import type { ChatMessage, StreamEvent, ToolCall } from '~/types'

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentSessionId = ref<string | null>(null)
  const activeTools = ref<ToolCall[]>([])

  async function createSession(): Promise<string> {
    const session = await $fetch('/api/sessions', { method: 'POST', body: {} })
    currentSessionId.value = session.id
    messages.value = []
    return session.id
  }

  async function loadSession(sessionId: string) {
    const session = await $fetch(`/api/sessions/${sessionId}`)
    currentSessionId.value = session.id
    messages.value = (session.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls || [],
      createdAt: m.createdAt,
    }))
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isStreaming.value) return

    let sessionId = currentSessionId.value
    if (!sessionId) {
      sessionId = await createSession()
    }

    messages.value.push({ role: 'user', content: prompt })
    isStreaming.value = true
    activeTools.value = []

    const assistantMessage: ChatMessage = { role: 'assistant', content: '', toolCalls: [] }
    messages.value.push(assistantMessage)

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
            handleStreamEvent(event, assistantMessage)
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: StreamEvent = JSON.parse(buffer)
          handleStreamEvent(event, assistantMessage)
        } catch {
          // skip
        }
      }
    } catch (err) {
      assistantMessage.content += `\n\nError: ${err}`
    } finally {
      isStreaming.value = false
      activeTools.value = []
    }
  }

  function handleStreamEvent(event: StreamEvent, message: ChatMessage) {
    switch (event.type) {
      case 'text':
        message.content += event.content || ''
        break
      case 'tool_call':
        activeTools.value.push({
          name: event.tool || 'unknown',
          input: (event.input as Record<string, unknown>) || {},
        })
        break
      case 'tool_result': {
        const tool = activeTools.value.find((t) => t.name === event.tool && !t.output)
        if (tool) {
          tool.output = event.output
          tool.isError = event.isError
          message.toolCalls = [...(message.toolCalls || []), { ...tool }]
        }
        activeTools.value = activeTools.value.filter((t) => t.output === undefined)
        break
      }
      case 'error':
        message.content += `\n\nError: ${event.message}`
        break
    }
  }

  return {
    messages,
    isStreaming,
    currentSessionId,
    activeTools,
    createSession,
    loadSession,
    sendMessage,
  }
}
