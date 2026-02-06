import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getJobs, createJob, updateJob, deleteJob, runJobNow } from './jobs'

describe('Jobs API', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  describe('getJobs', () => {
    it('fetches list of scheduled jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          name: 'Daily Summary',
          prompt: 'Summarize my notes',
          cron: '0 9 * * *',
          enabled: true,
          oneOff: false,
          lastRun: null,
          lastStatus: null,
          lastOutput: null,
          nextRun: '2026-02-05T09:00:00Z',
          createdAt: '2026-02-01',
        },
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockJobs,
      })

      const jobs = await getJobs()

      expect(fetch).toHaveBeenCalledWith('/api/jobs')
      expect(jobs).toHaveLength(1)
      expect(jobs[0].name).toBe('Daily Summary')
    })
  })

  describe('createJob', () => {
    it('creates a new scheduled job', async () => {
      const newJob = {
        name: 'Morning Briefing',
        prompt: 'What is on my calendar today?',
        cron: '0 8 * * *',
        enabled: true,
      }

      const mockCreated = {
        id: 'job-123',
        ...newJob,
        oneOff: false,
        lastRun: null,
        lastStatus: null,
        lastOutput: null,
        nextRun: '2026-02-05T08:00:00Z',
        createdAt: '2026-02-04',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCreated,
      })

      const created = await createJob(newJob)

      expect(fetch).toHaveBeenCalledWith('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      })
      expect(created.id).toBe('job-123')
      expect(created.name).toBe('Morning Briefing')
    })
  })

  describe('updateJob', () => {
    it('updates an existing job', async () => {
      const updates = { enabled: false }
      const mockUpdated = {
        id: 'job-123',
        name: 'Morning Briefing',
        prompt: 'What is on my calendar today?',
        cron: '0 8 * * *',
        enabled: false,
        oneOff: false,
        lastRun: null,
        lastStatus: null,
        lastOutput: null,
        nextRun: null,
        createdAt: '2026-02-04',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUpdated,
      })

      const updated = await updateJob('job-123', updates)

      expect(fetch).toHaveBeenCalledWith('/api/jobs/job-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      expect(updated.enabled).toBe(false)
    })
  })

  describe('deleteJob', () => {
    it('deletes a job by ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      })

      await deleteJob('job-123')

      expect(fetch).toHaveBeenCalledWith('/api/jobs/job-123', {
        method: 'DELETE',
      })
    })
  })

  describe('runJobNow', () => {
    it('triggers immediate job execution', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Job triggered' }),
      })

      await runJobNow('job-123')

      expect(fetch).toHaveBeenCalledWith('/api/jobs/job-123/run', {
        method: 'POST',
      })
    })
  })
})
