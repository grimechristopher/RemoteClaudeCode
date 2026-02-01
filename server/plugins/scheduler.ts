import { initScheduler } from '~/server/utils/scheduler'

export default defineNitroPlugin(async () => {
  await initScheduler()
})
