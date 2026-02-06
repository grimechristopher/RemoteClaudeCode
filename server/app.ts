import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Middleware
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Serve Vue frontend
const frontendDist = join(__dirname, '../frontend-new/dist')
app.use(express.static(frontendDist))

// SPA fallback
app.use((req, res) => {
  res.sendFile(join(frontendDist, 'index.html'))
})

export default app
