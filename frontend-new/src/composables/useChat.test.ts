import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChat } from './useChat'
import * as chatApi from '../api/chat'

vi.mock('../api/chat')

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty feed items', () => {
    const { feedItems } = useChat()
    expect(feedItems.value).toEqual([])
  })

  it('starts with no active session', () => {
    const { sessionId } = useChat()
    expect(sessionId.value).toBeNull()
  })

  it('starts with isStreaming false', () => {
    const { isStreaming } = useChat()
    expect(isStreaming.value).toBe(false)
  })

  it('creates a new session', async () => {
    const mockSession = {
      id: 'new-session-123',
      title: 'New Chat',
      createdAt: new Date().toISOString(),
    }

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)

    const { createNewSession, sessionId } = useChat()
    await createNewSession()

    expect(chatApi.createSession).toHaveBeenCalled()
    expect(sessionId.value).toBe('new-session-123')
  })

  it('adds user message to feed when sending', async () => {
    const mockSession = {
      id: 'session-123',
      title: 'Test',
      createdAt: new Date().toISOString(),
    }

    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    } as any

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)
    vi.mocked(chatApi.sendMessage).mockResolvedValue(mockReader)

    const { sendUserMessage, feedItems } = useChat()
    await sendUserMessage('Hello!')

    expect(feedItems.value).toHaveLength(1)
    expect(feedItems.value[0]).toMatchObject({
      type: 'user',
      content: 'Hello!',
    })
  })

  it('sets isStreaming true while sending message', async () => {
    const mockSession = {
      id: 'session-123',
      title: 'Test',
      createdAt: new Date().toISOString(),
    }

    let resolveRead: any
    const mockReader = {
      read: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRead = resolve
        })
      ),
    } as any

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)
    vi.mocked(chatApi.sendMessage).mockResolvedValue(mockReader)

    const { sendUserMessage, isStreaming } = useChat()

    const promise = sendUserMessage('Hello!')
    expect(isStreaming.value).toBe(true)

    resolveRead({ done: true, value: undefined })
    await promise

    expect(isStreaming.value).toBe(false)
  })

  it('starts with no system prompt', () => {
    const { systemPrompt } = useChat()
    expect(systemPrompt.value).toBeNull()
  })

  it('loads a session with messages', async () => {
    const mockSession = {
      id: 'session-456',
      title: 'Previous Chat',
      systemPrompt: 'You are helpful',
      createdAt: '2026-02-01',
      messages: [
        {
          id: 'msg-1',
          sessionId: 'session-456',
          role: 'user' as const,
          content: 'Hello',
          feedItems: [
            {
              type: 'user' as const,
              content: 'Hello',
              timestamp: '2026-02-01T10:00:00Z',
            },
          ],
          createdAt: '2026-02-01T10:00:00Z',
        },
        {
          id: 'msg-2',
          sessionId: 'session-456',
          role: 'assistant' as const,
          content: 'Hi there!',
          feedItems: [
            {
              type: 'text' as const,
              content: 'Hi there!',
              timestamp: '2026-02-01T10:00:05Z',
            },
          ],
          createdAt: '2026-02-01T10:00:05Z',
        },
      ],
    }

    vi.mocked(chatApi.getSession).mockResolvedValue(mockSession as any)

    const { loadSession, sessionId, systemPrompt, feedItems } = useChat()
    await loadSession('session-456')

    expect(chatApi.getSession).toHaveBeenCalledWith('session-456')
    expect(sessionId.value).toBe('session-456')
    expect(systemPrompt.value).toBe('You are helpful')
    expect(feedItems.value).toHaveLength(2)
    expect(feedItems.value[0].content).toBe('Hello')
  })

  it('updates system prompt', async () => {
    const mockSession = {
      id: 'session-123',
      title: 'Test',
      createdAt: '2026-02-01',
    }

    const mockUpdated = {
      ...mockSession,
      systemPrompt: 'New prompt',
    }

    vi.mocked(chatApi.createSession).mockResolvedValue(mockSession)
    vi.mocked(chatApi.updateSession).mockResolvedValue(mockUpdated)

    const { createNewSession, updateSystemPrompt, systemPrompt } = useChat()
    await createNewSession()
    await updateSystemPrompt('New prompt')

    expect(chatApi.updateSession).toHaveBeenCalledWith('session-123', {
      systemPrompt: 'New prompt',
    })
    expect(systemPrompt.value).toBe('New prompt')
  })

  it('clears session and feed', () => {
    const { sessionId, feedItems, clearSession } = useChat()

    // Setup some state
    sessionId.value = 'test-123'
    feedItems.value = [{ type: 'user', content: 'test', timestamp: '2026-02-01' }]

    clearSession()

    expect(sessionId.value).toBeNull()
    expect(feedItems.value).toEqual([])
  })
})
