import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(sessions).where(eq(sessions.id, id))
  return { success: true }
})
