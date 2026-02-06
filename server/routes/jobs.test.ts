import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jobsRouter from './jobs.js'

vi.mock('../utils/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-job' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'test-id', name: 'Updated Job' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  },
}))

describe('Jobs endpoints', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', jobsRouter)
    vi.clearAllMocks()
  })

  it('GET /api/jobs returns jobs list', async () => {
    const res = await request(app).get('/api/jobs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/jobs creates new job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        name: 'Test Job',
        prompt: 'Do something',
        cron: '0 0 * * *',
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('POST /api/jobs requires name, prompt, and cron', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        name: 'Test Job',
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

  it('PUT /api/jobs/:id updates job', async () => {
    const res = await request(app)
      .put('/api/jobs/test-id')
      .send({ name: 'Updated Job' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('PATCH /api/jobs/:id updates job', async () => {
    const res = await request(app)
      .patch('/api/jobs/test-id')
      .send({ enabled: false })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('DELETE /api/jobs/:id deletes job', async () => {
    const res = await request(app).delete('/api/jobs/test-id')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
  })
})
