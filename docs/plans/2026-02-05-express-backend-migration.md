# Express Backend Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from Nuxt/H3 backend to pure Express with TypeScript support, eliminating the proxy architecture and creating a single-server deployment.

**Architecture:** Replace Nuxt/H3 event handlers with Express routes while keeping all business logic (Claude SDK, Drizzle ORM, utilities) unchanged. Use tsx to run TypeScript directly without compilation. Implement standard SSE for streaming responses.

**Tech Stack:** Express, TypeScript, tsx, Drizzle ORM, PostgreSQL, Claude Agent SDK

---

## Task 1: Install tsx and update package.json

**Files:**
- Modify: `package.json`

**Step 1: Install tsx**

Run:
```bash
npm install tsx
```

**Step 2: Update package.json scripts**

Remove Nuxt scripts, add Express scripts:

```json
{
  "scripts": {
    "dev": "tsx watch server/index.ts",
    "start": "tsx server/index.ts",
    "build": "cd frontend-new && npm run build:prod"
  }
}
```

**Step 3: Verify installation**

Run: `npx tsx --version`
Expected: Version number output

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add tsx for TypeScript execution"
```

---

## Task 2: Create Express app foundation with SSE helper

**Files:**
- Create: `server/app.ts`
- Create: `server/index.ts`
- Create: `server/utils/sse.ts`

**Step 1: Write test for SSE helper**

Create: `server/utils/sse.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createSSEStream } from './sse'

describe('createSSEStream', () => {
  it('sets correct headers', () => {
    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any

    createSSEStream(res)

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
  })

  it('pushes data in SSE format', () => {
    const res = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any

    const stream = createSSEStream(res)
    stream.push('{"type":"test"}')

    expect(res.write).toHaveBeenCalledWith('data: {"type":"test"}\n\n')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test server/utils/sse.test.ts`
Expected: FAIL - module not found

**Step 3: Write SSE helper implementation**

Create: `server/utils/sse.ts`

```typescript
import { Response } from 'express'

export interface SSEStream {
  push: (data: string) => void
  close: () => void
}

export function createSSEStream(res: Response): SSEStream {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  return {
    push: (data: string) => {
      res.write(`data: ${data}\n\n`)
    },
    close: () => {
      res.end()
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test server/utils/sse.test.ts`
Expected: PASS

**Step 5: Create Express app**

Create: `server/app.ts`

```typescript
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
```

**Step 6: Create server entry point**

Create: `server/index.ts`

```typescript
import app from './app.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
```

**Step 7: Test server starts**

Run: `npm run dev`
Expected: Server starts on port 3000, no errors

**Step 8: Test health endpoint**

Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add server/app.ts server/index.ts server/utils/sse.ts server/utils/sse.test.ts
git commit -m "feat: create Express app foundation with SSE helper"
```

---

## Task 3: Migrate Claude streaming endpoint (POST /api/claude)

**Files:**
- Create: `server/routes/claude.ts`
- Reference: `server/api/claude.post.ts` (Nuxt handler)
- Reference: `server/utils/claude.ts` (unchanged)
- Reference: `server/utils/db.ts` (unchanged)

**Step 1: Write test for Claude endpoint**

Create: `server/routes/claude.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import claudeRouter from './claude'

// Mock dependencies
vi.mock('../utils/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    query: {
      sessions: {
        findFirst: vi.fn(),
      },
    },
  },
}))

vi.mock('../utils/claude', () => ({
  runClaude: vi.fn(),
}))

describe('POST /api/claude', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', claudeRouter)
    vi.clearAllMocks()
  })

  it('returns 400 if prompt is missing', async () => {
    const res = await request(app)
      .post('/api/claude')
      .send({ sessionId: 'test-123' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('prompt')
  })

  it('returns 400 if sessionId is missing', async () => {
    const res = await request(app)
      .post('/api/claude')
      .send({ prompt: 'Hello' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('sessionId')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test server/routes/claude.test.ts`
Expected: FAIL - module not found

**Step 3: Implement Claude route**

Create: `server/routes/claude.ts`

```typescript
import { Router } from 'express'
import { db } from '../utils/db.js'
import { messages, sessions } from '../db/schema.js'
import { runClaude } from '../utils/claude.js'
import { createSSEStream } from '../utils/sse.js'
import { eq } from 'drizzle-orm'

const router = Router()

router.post('/claude', async (req, res) => {
  const { prompt, sessionId } = req.body

  if (!prompt || !sessionId) {
    return res.status(400).json({ message: 'prompt and sessionId required' })
  }

  try {
    // Save user message with feed item
    const userFeedItem = {
      type: 'user' as const,
      content: prompt,
      timestamp: new Date().toISOString(),
    }
    await db.insert(messages).values({
      sessionId,
      role: 'user',
      content: prompt,
      feedItems: [userFeedItem],
    })

    // Look up existing Claude session ID and system prompt
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    })

    const eventStream = createSSEStream(res)

    const claudePromise = runClaude(
      prompt,
      {
        onMessage: async (data) => {
          eventStream.push(JSON.stringify(data))
        },
      },
      {
        sessionId: session?.claudeSessionId || undefined,
        systemPrompt: session?.systemPrompt || undefined,
      }
    )

    claudePromise
      .then(async ({ claudeSessionId, fullContent, toolCalls, feedItems }) => {
        // Save assistant message with feed items
        await db.insert(messages).values({
          sessionId,
          role: 'assistant',
          content: fullContent,
          toolCalls,
          feedItems,
        })

        // Update session
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        }
        if (claudeSessionId) {
          updateData.claudeSessionId = claudeSessionId
        }

        await db
          .update(sessions)
          .set(updateData)
          .where(eq(sessions.id, sessionId))

        eventStream.close()
      })
      .catch(async (error) => {
        console.error('Claude error:', error)
        eventStream.push(
          JSON.stringify({
            type: 'error',
            content: error.message,
          })
        )
        eventStream.close()
      })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
```

**Step 4: Run test to verify it passes**

Run: `npm test server/routes/claude.test.ts`
Expected: PASS

**Step 5: Add route to app**

Modify: `server/app.ts`

```typescript
import claudeRouter from './routes/claude.js'

// ... after middleware
app.use('/api', claudeRouter)
```

**Step 6: Manual test with Playwright**

Use @playwright-skill:playwright-skill to test sending a message and receiving streamed response.

**Step 7: Commit**

```bash
git add server/routes/claude.ts server/routes/claude.test.ts server/app.ts
git commit -m "feat: migrate Claude streaming endpoint to Express"
```

---

## Task 4: Migrate sessions endpoints

**Files:**
- Create: `server/routes/sessions.ts`
- Reference: `server/api/sessions/*.ts` (Nuxt handlers)

**Step 1: Write tests for sessions endpoints**

Create: `server/routes/sessions.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import sessionsRouter from './sessions'

vi.mock('../utils/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{ id: 'new-session' }]) })),
    query: {
      sessions: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  },
}))

describe('Sessions endpoints', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', sessionsRouter)
    vi.clearAllMocks()
  })

  it('GET /api/sessions returns sessions list', async () => {
    const res = await request(app).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/sessions creates new session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ title: 'Test Session' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('GET /api/sessions/:id returns 404 if not found', async () => {
    const res = await request(app).get('/api/sessions/nonexistent')
    expect(res.status).toBe(404)
  })

  it('PATCH /api/sessions/:id updates session', async () => {
    const res = await request(app)
      .patch('/api/sessions/test-id')
      .send({ title: 'Updated' })

    expect(res.status).toBe(200)
  })

  it('DELETE /api/sessions/:id deletes session', async () => {
    const res = await request(app).delete('/api/sessions/test-id')
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test server/routes/sessions.test.ts`
Expected: FAIL - module not found

**Step 3: Implement sessions routes**

Create: `server/routes/sessions.ts`

```typescript
import { Router } from 'express'
import { db } from '../utils/db.js'
import { sessions, messages } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

const router = Router()

// GET /api/sessions - List all sessions
router.get('/sessions', async (req, res) => {
  try {
    const allSessions = await db.query.sessions.findMany({
      orderBy: desc(sessions.updatedAt),
    })

    const result = allSessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      systemPrompt: s.systemPrompt,
    }))

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/sessions - Create new session
router.post('/sessions', async (req, res) => {
  try {
    const { title } = req.body
    const [session] = await db
      .insert(sessions)
      .values({
        title: title || 'New Session',
      })
      .returning()

    res.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      systemPrompt: session.systemPrompt,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// GET /api/sessions/:id - Get single session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, req.params.id),
    })

    if (!session) {
      return res.status(404).json({ message: 'Session not found' })
    }

    const sessionMessages = await db.query.messages.findMany({
      where: eq(messages.sessionId, req.params.id),
      orderBy: desc(messages.createdAt),
    })

    res.json({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      systemPrompt: session.systemPrompt,
      messages: sessionMessages,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// PATCH /api/sessions/:id - Update session
router.patch('/sessions/:id', async (req, res) => {
  try {
    const { title, systemPrompt } = req.body
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt

    await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, req.params.id))

    const updated = await db.query.sessions.findFirst({
      where: eq(sessions.id, req.params.id),
    })

    res.json({
      id: updated.id,
      title: updated.title,
      createdAt: updated.createdAt.toISOString(),
      systemPrompt: updated.systemPrompt,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// DELETE /api/sessions/:id - Delete session
router.delete('/sessions/:id', async (req, res) => {
  try {
    await db.delete(messages).where(eq(messages.sessionId, req.params.id))
    await db.delete(sessions).where(eq(sessions.id, req.params.id))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
```

**Step 4: Run test to verify it passes**

Run: `npm test server/routes/sessions.test.ts`
Expected: PASS

**Step 5: Add route to app**

Modify: `server/app.ts`

```typescript
import sessionsRouter from './routes/sessions.js'

// ... after claudeRouter
app.use('/api', sessionsRouter)
```

**Step 6: Manual test sessions CRUD**

Use @playwright-skill:playwright-skill or curl to test creating, listing, updating, and deleting sessions.

**Step 7: Commit**

```bash
git add server/routes/sessions.ts server/routes/sessions.test.ts server/app.ts
git commit -m "feat: migrate sessions endpoints to Express"
```

---

## Task 5: Migrate jobs endpoints

**Files:**
- Create: `server/routes/jobs.ts`
- Reference: `server/api/jobs/*.ts` (Nuxt handlers)

**Step 1: Write tests for jobs endpoints**

Create: `server/routes/jobs.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jobsRouter from './jobs'

vi.mock('../utils/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{ id: 'new-job' }]) })),
    query: {
      jobs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  },
}))

describe('Jobs endpoints', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api', jobsRouter)
    vi.clearAllMocks()
  })

  it('GET /api/jobs returns jobs list', async () => {
    const res = await request(app).get('/api/jobs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/jobs creates new job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        name: 'Test Job',
        prompt: 'Do something',
        cron: '0 0 * * *',
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('PUT /api/jobs/:id updates job', async () => {
    const res = await request(app)
      .put('/api/jobs/test-id')
      .send({ name: 'Updated Job' })

    expect(res.status).toBe(200)
  })

  it('DELETE /api/jobs/:id deletes job', async () => {
    const res = await request(app).delete('/api/jobs/test-id')
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test server/routes/jobs.test.ts`
Expected: FAIL - module not found

**Step 3: Implement jobs routes**

Create: `server/routes/jobs.ts`

```typescript
import { Router } from 'express'
import { db } from '../utils/db.js'
import { jobs } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const router = Router()

// GET /api/jobs - List all jobs
router.get('/jobs', async (req, res) => {
  try {
    const allJobs = await db.query.jobs.findMany()
    res.json(allJobs)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/jobs - Create new job
router.post('/jobs', async (req, res) => {
  try {
    const { name, prompt, cron, enabled, oneOff } = req.body

    if (!name || !prompt || !cron) {
      return res.status(400).json({ message: 'name, prompt, and cron required' })
    }

    const [job] = await db
      .insert(jobs)
      .values({
        name,
        prompt,
        cron,
        enabled: enabled ?? true,
        oneOff: oneOff ?? false,
      })
      .returning()

    res.json(job)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// PUT /api/jobs/:id - Update job
router.put('/jobs/:id', async (req, res) => {
  try {
    const { name, prompt, cron, enabled, oneOff } = req.body
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (prompt !== undefined) updateData.prompt = prompt
    if (cron !== undefined) updateData.cron = cron
    if (enabled !== undefined) updateData.enabled = enabled
    if (oneOff !== undefined) updateData.oneOff = oneOff

    await db.update(jobs).set(updateData).where(eq(jobs.id, req.params.id))

    const updated = await db.query.jobs.findFirst({
      where: eq(jobs.id, req.params.id),
    })

    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// DELETE /api/jobs/:id - Delete job
router.delete('/jobs/:id', async (req, res) => {
  try {
    await db.delete(jobs).where(eq(jobs.id, req.params.id))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
```

**Step 4: Run test to verify it passes**

Run: `npm test server/routes/jobs.test.ts`
Expected: PASS

**Step 5: Add route to app**

Modify: `server/app.ts`

```typescript
import jobsRouter from './routes/jobs.js'

// ... after sessionsRouter
app.use('/api', jobsRouter)
```

**Step 6: Manual test jobs CRUD**

Use @playwright-skill:playwright-skill to test Dashboard view - create, list, update, delete jobs.

**Step 7: Commit**

```bash
git add server/routes/jobs.ts server/routes/jobs.test.ts server/app.ts
git commit -m "feat: migrate jobs endpoints to Express"
```

---

## Task 6: Update Dockerfile for tsx

**Files:**
- Modify: `Dockerfile`
- Delete: `start.sh`

**Step 1: Remove start.sh**

Run: `git rm start.sh`

**Step 2: Update Dockerfile**

Modify: `Dockerfile`

```dockerfile
FROM node:20-slim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install git (Claude Code needs it)
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Build frontend
COPY frontend-new ./frontend-new
WORKDIR /app/frontend-new
RUN npm ci && npm run build:prod

# Copy backend code
WORKDIR /app
COPY server ./server

# Create data directories for mounts
RUN mkdir -p /data/notes /data/repos

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
```

**Step 3: Build Docker image**

Run: `docker build -t remote-claude-code .`
Expected: Build succeeds

**Step 4: Test Docker container**

Run: `docker run -d -p 3000:3000 --env-file .env --name claude-test remote-claude-code`
Expected: Container starts

**Step 5: Verify with Playwright**

Use @playwright-skill:playwright-skill to test http://localhost:3000 - verify all features work.

**Step 6: Stop test container**

Run: `docker stop claude-test && docker rm claude-test`

**Step 7: Commit**

```bash
git add Dockerfile
git commit -m "feat: update Dockerfile to use tsx instead of Nuxt"
```

---

## Task 7: Clean up Nuxt dependencies

**Files:**
- Modify: `package.json`
- Delete: `nuxt.config.ts`
- Delete: `app.vue`
- Delete: `.nuxt/` (if exists)

**Step 1: Remove Nuxt from package.json**

Modify: `package.json` - remove these dependencies:
- `nuxt`
- `@nuxt/*` packages
- `nitro`

Keep:
- `express`
- `tsx`
- `drizzle-orm`
- `postgres`
- `@anthropic-ai/claude-agent-sdk`
- `node-cron`
- `vue` and `vue-router` (frontend only)

**Step 2: Delete Nuxt config files**

Run:
```bash
git rm nuxt.config.ts app.vue
rm -rf .nuxt
```

**Step 3: Install cleaned dependencies**

Run: `npm install`

**Step 4: Run all tests**

Run: `npm test`
Expected: All backend route tests pass

**Step 5: Run frontend tests**

Run: `cd frontend-new && npm test`
Expected: All 35 tests pass

**Step 6: Manual integration test**

Run: `npm run dev`
Use @playwright-skill:playwright-skill to verify full stack works.

**Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove Nuxt dependencies"
```

---

## Task 8: Final integration testing

**Files:**
- Reference: All endpoints

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on port 3000

**Step 2: Test health endpoint**

Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

**Step 3: Test frontend loads**

Use @playwright-skill:playwright-skill - verify app loads at http://localhost:3000

**Step 4: Test chat streaming**

Use @playwright-skill:playwright-skill - send message, verify SSE streaming works

**Step 5: Test sessions CRUD**

Use @playwright-skill:playwright-skill - create session, list, update, delete

**Step 6: Test jobs CRUD**

Use @playwright-skill:playwright-skill - navigate to Dashboard, create job, verify it appears

**Step 7: Test system prompt**

Use @playwright-skill:playwright-skill - open system prompt modal, save, verify it persists

**Step 8: Commit**

```bash
git add -A
git commit -m "test: verify full stack integration"
```

---

## Task 9: Production Docker deployment test

**Files:**
- Reference: `Dockerfile`

**Step 1: Build production image**

Run: `docker build -t remote-claude-code:prod .`
Expected: Build succeeds

**Step 2: Run production container**

Run:
```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name claude-prod-test \
  remote-claude-code:prod
```

Expected: Container starts

**Step 3: Wait for startup**

Run: `sleep 5 && docker logs claude-prod-test`
Expected: "Server running on http://0.0.0.0:3000"

**Step 4: Test all features**

Use @playwright-skill:playwright-skill - comprehensive test of all features

**Step 5: Check container logs for errors**

Run: `docker logs claude-prod-test`
Expected: No errors

**Step 6: Stop and remove test container**

Run: `docker stop claude-prod-test && docker rm claude-prod-test`

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat: production-ready Express backend migration complete"
```

---

## Success Criteria

- ✅ All backend route tests pass
- ✅ All frontend tests pass (35/35)
- ✅ Docker container runs single Express server (no Nuxt)
- ✅ SSE streaming works for Claude responses
- ✅ All CRUD operations work (sessions, jobs)
- ✅ System prompts persist correctly
- ✅ No Nuxt dependencies remaining
- ✅ Production Docker image < 500MB
- ✅ tsx runs TypeScript without compilation step

## Rollback Plan

If migration fails:
1. Revert to previous commit
2. Restart Nuxt + Express proxy setup
3. Debug issue before retrying

## Post-Migration

After successful migration:
- Update README with new setup instructions
- Document API endpoints in OpenAPI spec
- Consider adding API rate limiting
- Consider adding request logging middleware
- Monitor container memory usage in production
