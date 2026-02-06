import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSession,
  sendMessage,
  getSessions,
  getSession,
  updateSession,
  deleteSession,
} from './chat'

describe('Chat API', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn()
  })

  describe('createSession', () => {
    it('creates a new chat session', async () => {
      const mockSession = {
        id: 'test-session-123',
        title: 'New Chat',
        createdAt: new Date().toISOString(),
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      })

      const session = await createSession()

      expect(fetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(session.id).toBe('test-session-123')
    })

    it('throws error when session creation fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(createSession()).rejects.toThrow('Failed to create session')
    })
  })

  describe('sendMessage', () => {
    it('sends message and returns stream reader', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn(),
          }),
        },
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const reader = await sendMessage('test-session-123', 'Hello!')

      expect(fetch).toHaveBeenCalledWith('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session-123',
          prompt: 'Hello!',
        }),
      })
      expect(reader).toBeDefined()
      expect(mockResponse.body.getReader).toHaveBeenCalled()
    })

    it('throws error when message send fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      })

      await expect(
        sendMessage('test-session-123', 'Hello!')
      ).rejects.toThrow('Failed to send message')
    })
  })

  describe('getSessions', () => {
    it('fetches list of sessions', async () => {
      const mockSessions = [
        { id: 'session-1', title: 'Chat 1', createdAt: '2026-02-01' },
        { id: 'session-2', title: 'Chat 2', createdAt: '2026-02-02' },
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSessions,
      })

      const sessions = await getSessions()

      expect(fetch).toHaveBeenCalledWith('/api/sessions')
      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe('session-1')
    })
  })

  describe('getSession', () => {
    it('fetches single session by ID', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Test Chat',
        systemPrompt: 'You are helpful',
        createdAt: '2026-02-01',
        messages: [],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      })

      const session = await getSession('session-123')

      expect(fetch).toHaveBeenCalledWith('/api/sessions/session-123')
      expect(session.id).toBe('session-123')
      expect(session.systemPrompt).toBe('You are helpful')
    })
  })

  describe('updateSession', () => {
    it('updates session with new data', async () => {
      const mockUpdated = {
        id: 'session-123',
        title: 'Updated Title',
        systemPrompt: 'New prompt',
        createdAt: '2026-02-01',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUpdated,
      })

      const updated = await updateSession('session-123', {
        systemPrompt: 'New prompt',
        title: 'Updated Title',
      })

      expect(fetch).toHaveBeenCalledWith('/api/sessions/session-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'New prompt',
          title: 'Updated Title',
        }),
      })
      expect(updated.systemPrompt).toBe('New prompt')
    })
  })

  describe('deleteSession', () => {
    it('deletes session by ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      })

      await deleteSession('session-123')

      expect(fetch).toHaveBeenCalledWith('/api/sessions/session-123', {
        method: 'DELETE',
      })
    })
  })
})
