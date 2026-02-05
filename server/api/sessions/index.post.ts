import { sessions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [session] = await db.insert(sessions).values({
    title: body.title || 'New Chat',
    systemPrompt: body.systemPrompt || null,
  }).returning()
  return session
})
