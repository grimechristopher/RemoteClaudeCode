import { runClaude } from '~/server/utils/claude'
import { db } from '~/server/utils/db'
import { messages, sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { prompt, sessionId } = await readBody<{
    prompt: string
    sessionId: string
  }>(event)

  if (!prompt || !sessionId) {
    throw createError({ statusCode: 400, message: 'prompt and sessionId required' })
  }

  // Save user message
  await db.insert(messages).values({
    sessionId,
    role: 'user',
    content: prompt,
  })

  // Look up existing Claude session ID for resumption
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  })

  const eventStream = createEventStream(event)

  // Run Claude in background, stream results
  const claudePromise = runClaude(prompt, {
    onMessage: async (data) => {
      await eventStream.push(JSON.stringify(data))
    },
  }, {
    sessionId: session?.claudeSessionId || undefined,
  })

  claudePromise
    .then(async ({ claudeSessionId, fullContent, toolCalls }) => {
      // Save assistant message
      await db.insert(messages).values({
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls,
      })

      // Update session with Claude session ID and title
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }
      if (claudeSessionId) {
        updateData.claudeSessionId = claudeSessionId
      }
      if (!session?.title || session.title === 'New Chat') {
        updateData.title = prompt.slice(0, 80)
      }
      await db.update(sessions).set(updateData).where(eq(sessions.id, sessionId))

      await eventStream.push(JSON.stringify({ type: 'done' }))
      await eventStream.close()
    })
    .catch(async (err) => {
      await eventStream.push(JSON.stringify({ type: 'error', message: String(err) }))
      await eventStream.close()
    })

  eventStream.onClosed(async () => {
    // Cleanup if client disconnects
  })

  return eventStream.send()
})
