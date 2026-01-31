import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      },
    },
  })
  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  return session
})
