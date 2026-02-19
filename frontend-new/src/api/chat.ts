import { getAuthHeaders } from '../utils/auth'

export interface Session {
  id: string
  title: string
  createdAt: string
  systemPrompt?: string | null
}

export async function createSession(): Promise<Session> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: '{}',
  })

  if (!response.ok) {
    throw new Error('Failed to create session')
  }

  return response.json()
}

export async function sendMessage(
  sessionId: string,
  prompt: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ sessionId, prompt }),
  })

  if (!response.ok) {
    throw new Error('Failed to send message')
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  return response.body.getReader()
}

export async function getSessions(): Promise<Session[]> {
  const response = await fetch('/api/sessions', {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to fetch sessions')
  }

  return response.json()
}

export async function getSession(sessionId: string): Promise<Session> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to fetch session')
  }

  return response.json()
}

export async function updateSession(
  sessionId: string,
  data: { systemPrompt?: string | null; title?: string }
): Promise<Session> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to update session')
  }

  return response.json()
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to delete session')
  }
}
