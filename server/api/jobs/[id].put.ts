import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { unregisterJob, registerJob } from '~/server/utils/scheduler'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const [updated] = await db.update(scheduledJobs)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.prompt !== undefined && { prompt: body.prompt }),
      ...(body.cron !== undefined && { cron: body.cron }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.oneOff !== undefined && { oneOff: body.oneOff }),
    })
    .where(eq(scheduledJobs.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Job not found' })
  }

  unregisterJob(id)
  if (updated.enabled) {
    registerJob(updated)
  }

  return updated
})
