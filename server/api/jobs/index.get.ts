import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return await db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt))
})
