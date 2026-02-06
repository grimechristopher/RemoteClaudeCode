import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import sessionsRouter from './sessions'

vi.mock('../utils/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{
          id: 'new-session',
          title: 'Test Session',
          systemPrompt: null,
          createdAt: new Date('2024-01-01'),
        }])
      }))
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn().mockResolvedValue([])
      }))
    })),
    query: {
      sessions: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      messages: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            title: 'Updated',
            systemPrompt: null,
            createdAt: new Date('2024-01-01'),
          }])
        }))
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  },
}))

describe('Sessions endpoints', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', sessionsRouter)
    vi.clearAllMocks()
  })

  it('GET /api/sessions returns sessions list', async () => {
    const res = await request(app).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/sessions creates new session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ title: 'Test Session' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('GET /api/sessions/:id returns 404 if not found', async () => {
    const res = await request(app).get('/api/sessions/nonexistent')
    expect(res.status).toBe(404)
  })

  it('GET /api/sessions/:id returns session with messages', async () => {
    const { db } = await import('../utils/db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({
      id: 'test-id',
      title: 'Test Session',
      systemPrompt: null,
      claudeSessionId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    })
    vi.mocked(db.query.messages.findMany).mockResolvedValueOnce([])

    const res = await request(app).get('/api/sessions/test-id')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', 'test-id')
    expect(res.body).toHaveProperty('messages')
  })

  it('PATCH /api/sessions/:id updates session', async () => {
    const res = await request(app)
      .patch('/api/sessions/test-id')
      .send({ title: 'Updated' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('title', 'Updated')
  })

  it('DELETE /api/sessions/:id deletes session', async () => {
    const res = await request(app).delete('/api/sessions/test-id')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
  })
})
