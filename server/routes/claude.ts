import { Router } from 'express'
import { db } from '../utils/db.js'
import { messages, sessions } from '../db/schema.js'
import { runClaude } from '../utils/claude.js'
import { createSSEStream } from '../utils/sse.js'
import { eq } from 'drizzle-orm'

const router = Router()

router.post('/claude', async (req, res) => {
  const { prompt, sessionId } = req.body

  if (!prompt || !sessionId) {
    return res.status(400).json({ message: 'prompt and sessionId required' })
  }

  try {
    // Save user message with feed item
    const userFeedItem = {
      type: 'user' as const,
      content: prompt,
      timestamp: new Date().toISOString(),
    }
    await db.insert(messages).values({
      sessionId,
      role: 'user',
      content: prompt,
      feedItems: [userFeedItem],
    })

    // Look up existing Claude session ID and system prompt
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    })

    const eventStream = createSSEStream(res)

    const claudePromise = runClaude(
      prompt,
      {
        onMessage: async (data) => {
          eventStream.push(JSON.stringify(data))
        },
      },
      {
        sessionId: session?.claudeSessionId || undefined,
        systemPrompt: session?.systemPrompt || undefined,
      }
    )

    claudePromise
      .then(async ({ claudeSessionId, fullContent, toolCalls, feedItems }) => {
        // Save assistant message with feed items
        await db.insert(messages).values({
          sessionId,
          role: 'assistant',
          content: fullContent,
          toolCalls,
          feedItems,
        })

        // Update session
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        }
        if (claudeSessionId) {
          updateData.claudeSessionId = claudeSessionId
        }

        await db
          .update(sessions)
          .set(updateData)
          .where(eq(sessions.id, sessionId))

        eventStream.close()
      })
      .catch(async (error) => {
        console.error('Claude error:', error)
        eventStream.push(
          JSON.stringify({
            type: 'error',
            content: error.message,
          })
        )
        eventStream.close()
      })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
