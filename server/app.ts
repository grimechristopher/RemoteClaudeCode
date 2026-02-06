import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import claudeRouter from './routes/claude.js'
import sessionsRouter from './routes/sessions.js'
import jobsRouter from './routes/jobs.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Middleware
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// API routes
app.use('/api', claudeRouter)
app.use('/api', sessionsRouter)
app.use('/api', jobsRouter)

// Serve Vue frontend
const frontendDist = join(__dirname, '../frontend-new/dist')
app.use(express.static(frontendDist))

// SPA fallback
app.use((req, res) => {
  res.sendFile(join(frontendDist, 'index.html'))
})

export default app
