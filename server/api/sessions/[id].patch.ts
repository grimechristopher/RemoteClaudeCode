import { sessions } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }
  if (body.systemPrompt !== undefined) {
    updateData.systemPrompt = body.systemPrompt
  }
  if (body.title !== undefined) {
    updateData.title = body.title
  }

  const [updated] = await db.update(sessions)
    .set(updateData)
    .where(eq(sessions.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  return updated
})
