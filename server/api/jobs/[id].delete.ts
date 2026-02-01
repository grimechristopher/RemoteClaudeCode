import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { unregisterJob } from '~/server/utils/scheduler'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  unregisterJob(id)
  await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id))
  return { success: true }
})
