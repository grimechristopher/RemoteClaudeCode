import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [session] = await db.insert(sessions).values({
    title: body.title || 'New Chat',
  }).returning()
  return session
})
