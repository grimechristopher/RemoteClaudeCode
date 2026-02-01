import cron, { type ScheduledTask } from 'node-cron'
import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { runClaude } from '~/server/utils/claude'

const activeTasks = new Map<string, ScheduledTask>()

export function registerJob(job: typeof scheduledJobs.$inferSelect) {
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id)!.stop()
  }

  if (!job.enabled || !cron.validate(job.cron)) return

  const task = cron.schedule(job.cron, async () => {
    console.log(`[scheduler] Running job: ${job.name}`)
    try {
      const { fullContent } = await runClaude(job.prompt, {
        onMessage: async () => {},
      })

      await db.update(scheduledJobs).set({
        lastRun: new Date(),
        lastStatus: 'success',
        lastOutput: fullContent.slice(0, 10000),
      }).where(eq(scheduledJobs.id, job.id))

      if (job.oneOff) {
        await db.update(scheduledJobs).set({ enabled: false }).where(eq(scheduledJobs.id, job.id))
        task.stop()
        activeTasks.delete(job.id)
      }
    } catch (err) {
      await db.update(scheduledJobs).set({
        lastRun: new Date(),
        lastStatus: 'error',
        lastOutput: String(err).slice(0, 10000),
      }).where(eq(scheduledJobs.id, job.id))
    }
  })

  activeTasks.set(job.id, task)
}

export function unregisterJob(id: string) {
  const task = activeTasks.get(id)
  if (task) {
    task.stop()
    activeTasks.delete(id)
  }
}

export async function initScheduler() {
  const jobs = await db.select().from(scheduledJobs)
  for (const job of jobs) {
    if (job.enabled) {
      registerJob(job)
    }
  }
  console.log(`[scheduler] Registered ${activeTasks.size} jobs`)
}
