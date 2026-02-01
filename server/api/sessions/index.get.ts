import { sessions } from '../../db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return await db.select().from(sessions).orderBy(desc(sessions.updatedAt))
})
