import { scheduledJobs } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    prompt: string
    cron: string
    oneOff?: boolean
  }>(event)

  if (!body.name || !body.prompt || !body.cron) {
    throw createError({ statusCode: 400, message: 'name, prompt, and cron are required' })
  }

  const [job] = await db.insert(scheduledJobs).values({
    name: body.name,
    prompt: body.prompt,
    cron: body.cron,
    oneOff: body.oneOff || false,
  }).returning()

  registerJob(job)
  return job
})
