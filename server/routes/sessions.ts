import { Router } from 'express'
import { db } from '../utils/db.js'
import { sessions, messages } from '../db/schema.js'
import { eq, desc, asc } from 'drizzle-orm'

const router = Router()

// GET /api/sessions - List all sessions
router.get('/sessions', async (req, res) => {
  try {
    const allSessions = await db.select().from(sessions).orderBy(desc(sessions.updatedAt))
    res.json(allSessions)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/sessions - Create new session
router.post('/sessions', async (req, res) => {
  try {
    const { title, systemPrompt } = req.body
    const [session] = await db
      .insert(sessions)
      .values({
        title: title || 'New Chat',
        systemPrompt: systemPrompt || null,
      })
      .returning()

    res.json(session)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// GET /api/sessions/:id - Get single session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, req.params.id),
    })

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const sessionMessages = await db.query.messages.findMany({
      where: eq(messages.sessionId, req.params.id),
      orderBy: asc(messages.createdAt),
    })

    res.json({
      ...session,
      messages: sessionMessages,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// PATCH /api/sessions/:id - Update session
router.patch('/sessions/:id', async (req, res) => {
  try {
    const { title, systemPrompt } = req.body
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, req.params.id))
      .returning()

    if (!updated) {
      return res.status(404).json({ message: 'Session not found' })
    }

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// DELETE /api/sessions/:id - Delete session
router.delete('/sessions/:id', async (req, res) => {
  try {
    await db.delete(sessions).where(eq(sessions.id, req.params.id))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
