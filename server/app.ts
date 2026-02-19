import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import claudeRouter from './routes/claude.js'
import sessionsRouter from './routes/sessions.js'
import jobsRouter from './routes/jobs.js'
import { requireAuth } from './middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Middleware
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// API routes (protected with auth)
app.use('/api', requireAuth, claudeRouter)
app.use('/api', requireAuth, sessionsRouter)
app.use('/api', requireAuth, jobsRouter)

// Serve Vue frontend
const frontendDist = join(__dirname, '../frontend-new/dist')
app.use(express.static(frontendDist))

// SPA fallback
app.use((req, res) => {
  res.sendFile(join(frontendDist, 'index.html'))
})

export default app
