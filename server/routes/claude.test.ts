import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import claudeRouter from './claude'

// Mock dependencies
vi.mock('../utils/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
  },
}))

vi.mock('../utils/claude', () => ({
  runClaude: vi.fn(),
}))

describe('POST /api/claude', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', claudeRouter)
    vi.clearAllMocks()
  })

  it('returns 400 if prompt is missing', async () => {
    const res = await request(app)
      .post('/api/claude')
      .send({ sessionId: 'test-123' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('prompt')
  })

  it('returns 400 if sessionId is missing', async () => {
    const res = await request(app)
      .post('/api/claude')
      .send({ prompt: 'Hello' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('sessionId')
  })
})
