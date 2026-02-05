import { messages, sessions } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { prompt, sessionId } = await readBody<{
    prompt: string
    sessionId: string
  }>(event)

  if (!prompt || !sessionId) {
    throw createError({ statusCode: 400, message: 'prompt and sessionId required' })
  }

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

  const eventStream = createEventStream(event)

  const claudePromise = runClaude(prompt, {
    onMessage: async (data) => {
      await eventStream.push(JSON.stringify(data))
    },
  }, {
    sessionId: session?.claudeSessionId || undefined,
    systemPrompt: session?.systemPrompt || undefined,
  })

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
