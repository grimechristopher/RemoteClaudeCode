import { scheduledJobs } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  unregisterJob(id)
  await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id))
  return { success: true }
})
