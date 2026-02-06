import { Router } from 'express'
import { db } from '../utils/db.js'
import { scheduledJobs } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

const router = Router()

// GET /api/jobs - List all jobs
router.get('/jobs', async (req, res) => {
  try {
    const allJobs = await db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt))
    res.json(allJobs)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/jobs - Create new job
router.post('/jobs', async (req, res) => {
  try {
    const { name, prompt, cron, enabled, oneOff } = req.body

    if (!name || !prompt || !cron) {
      return res.status(400).json({ message: 'name, prompt, and cron are required' })
    }

    const [job] = await db
      .insert(scheduledJobs)
      .values({
        name,
        prompt,
        cron,
        enabled: enabled ?? true,
        oneOff: oneOff ?? false,
      })
      .returning()

    // TODO: Add registerJob(job) when scheduler is implemented
    res.json(job)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// Update job handler (shared by PUT and PATCH)
const updateJobHandler = async (req: any, res: any) => {
  try {
    const { name, prompt, cron, enabled, oneOff } = req.body
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (prompt !== undefined) updateData.prompt = prompt
    if (cron !== undefined) updateData.cron = cron
    if (enabled !== undefined) updateData.enabled = enabled
    if (oneOff !== undefined) updateData.oneOff = oneOff

    const [updated] = await db
      .update(scheduledJobs)
      .set(updateData)
      .where(eq(scheduledJobs.id, req.params.id))
      .returning()

    if (!updated) {
      return res.status(404).json({ message: 'Job not found' })
    }

    // TODO: Add unregisterJob(id) and registerJob(updated) when scheduler is implemented
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

// PUT /api/jobs/:id - Update job
router.put('/jobs/:id', updateJobHandler)

// PATCH /api/jobs/:id - Update job (alternative method for frontend compatibility)
router.patch('/jobs/:id', updateJobHandler)

// DELETE /api/jobs/:id - Delete job
router.delete('/jobs/:id', async (req, res) => {
  try {
    // TODO: Add unregisterJob(id) when scheduler is implemented
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, req.params.id))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
