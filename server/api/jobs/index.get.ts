import { scheduledJobs } from '../../db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return await db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt))
})
