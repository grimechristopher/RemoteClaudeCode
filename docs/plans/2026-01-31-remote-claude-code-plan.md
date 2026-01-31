# Remote Claude Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted Nuxt 3 web app that provides a chat interface and scheduled command dashboard for Claude Code running on a home server.

**Architecture:** Single Nuxt 3 app with server routes handling SSE streaming to the Claude Agent SDK, PostgreSQL via Drizzle ORM, and node-cron for scheduled jobs. Dockerized with mounted volumes for Obsidian vault and Claude Code credentials.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, @anthropic-ai/claude-agent-sdk, Drizzle ORM, PostgreSQL, node-cron, Docker

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `app.vue`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize Nuxt 3 project**

Run:
```bash
cd /home/chris/Documents/Github/RemoteClaudeCode
npx nuxi@latest init . --force --packageManager npm
```

**Step 2: Install dependencies**

Run:
```bash
npm install drizzle-orm postgres @anthropic-ai/claude-agent-sdk node-cron
npm install -D drizzle-kit @types/node-cron
```

**Step 3: Create .env.example**

Create `.env.example`:
```env
DATABASE_URL=postgresql://user:password@host:5432/remoteclaudecode
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 4: Update nuxt.config.ts**

Replace `nuxt.config.ts` with:
```typescript
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: true,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Remote Claude Code',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },
})
```

**Step 5: Create global CSS**

Create `assets/css/main.css`:
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-surface: #141414;
  --bg-elevated: #1a1a1a;
  --border: #1e1e1e;
  --border-hover: #2e2e2e;
  --text-primary: #e4e4e7;
  --text-secondary: #71717a;
  --text-dim: #52525b;
  --accent: #22d3ee;
  --accent-dim: rgba(34, 211, 238, 0.1);
  --accent-hover: rgba(34, 211, 238, 0.15);
  --success: #4ade80;
  --error: #f87171;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #__nuxt {
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--accent-dim);
  color: var(--accent);
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

a {
  color: var(--accent);
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

code, pre {
  font-family: var(--font-mono);
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Nuxt 3 project with dependencies and global styles"
```

---

### Task 2: Database Schema & Connection

**Files:**
- Create: `server/db/schema.ts`
- Create: `server/utils/db.ts`
- Create: `drizzle.config.ts`

**Step 1: Create Drizzle config**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
})
```

**Step 2: Create database schema**

Create `server/db/schema.ts`:
```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant'])
export const jobStatusEnum = pgEnum('job_status', ['success', 'error'])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  claudeSessionId: text('claude_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sessions_created_idx').on(table.createdAt),
])

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls').$type<Array<{
    name: string
    input: Record<string, unknown>
    output?: unknown
  }>>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_session_idx').on(table.sessionId),
  index('messages_created_idx').on(table.createdAt),
])

export const scheduledJobs = pgTable('scheduled_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  cron: text('cron').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  oneOff: boolean('one_off').default(false).notNull(),
  lastRun: timestamp('last_run', { withTimezone: true }),
  lastStatus: jobStatusEnum('last_status'),
  lastOutput: text('last_output'),
  nextRun: timestamp('next_run', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('jobs_enabled_idx').on(table.enabled),
  index('jobs_next_run_idx').on(table.nextRun),
])

export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}))
```

**Step 3: Create database connection utility**

Create `server/utils/db.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

const queryClient = postgres(useRuntimeConfig().databaseUrl, {
  prepare: false,
  max: 20,
})

export const db = drizzle(queryClient, { schema })
```

**Step 4: Generate and run migrations**

Run:
```bash
npx drizzle-kit generate
```

Expected: Migration SQL files created in `server/db/migrations/`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add database schema and Drizzle ORM setup"
```

---

### Task 3: Session API Routes

**Files:**
- Create: `server/api/sessions/index.get.ts`
- Create: `server/api/sessions/index.post.ts`
- Create: `server/api/sessions/[id].get.ts`
- Create: `server/api/sessions/[id].delete.ts`

**Step 1: List sessions endpoint**

Create `server/api/sessions/index.get.ts`:
```typescript
import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return await db.select().from(sessions).orderBy(desc(sessions.updatedAt))
})
```

**Step 2: Create session endpoint**

Create `server/api/sessions/index.post.ts`:
```typescript
import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [session] = await db.insert(sessions).values({
    title: body.title || 'New Chat',
  }).returning()
  return session
})
```

**Step 3: Get session with messages**

Create `server/api/sessions/[id].get.ts`:
```typescript
import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      },
    },
  })
  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  return session
})
```

**Step 4: Delete session endpoint**

Create `server/api/sessions/[id].delete.ts`:
```typescript
import { db } from '~/server/utils/db'
import { sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(sessions).where(eq(sessions.id, id))
  return { success: true }
})
```

**Step 5: Commit**

```bash
git add server/api/sessions/
git commit -m "feat: add session CRUD API routes"
```

---

### Task 4: Claude Code SSE Streaming Endpoint

**Files:**
- Create: `server/utils/claude.ts`
- Create: `server/api/claude.post.ts`

**Step 1: Create Claude Code execution utility**

Create `server/utils/claude.ts`:
```typescript
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export interface ClaudeStreamCallbacks {
  onMessage: (data: Record<string, unknown>) => Promise<void>
}

export async function runClaude(
  prompt: string,
  callbacks: ClaudeStreamCallbacks,
  options?: { sessionId?: string; cwd?: string },
) {
  const claudeQuery = query({
    prompt,
    options: {
      permissionMode: 'bypassPermissions',
      cwd: options?.cwd || process.cwd(),
      ...(options?.sessionId ? { resume: options.sessionId } : {}),
    },
  })

  let claudeSessionId: string | undefined
  let fullContent = ''
  const toolCalls: Array<{ name: string; input: Record<string, unknown>; output?: unknown }> = []
  let currentTool: { name: string; input: Record<string, unknown> } | null = null

  for await (const message of claudeQuery) {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          claudeSessionId = message.session_id
          await callbacks.onMessage({
            type: 'system',
            sessionId: message.session_id,
          })
        }
        break

      case 'assistant':
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              fullContent += block.text
              await callbacks.onMessage({
                type: 'text',
                content: block.text,
              })
            } else if (block.type === 'tool_use') {
              currentTool = { name: block.name, input: block.input as Record<string, unknown> }
              await callbacks.onMessage({
                type: 'tool_call',
                tool: block.name,
                input: block.input,
              })
            }
          }
        }
        break

      case 'user':
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'tool_result' && currentTool) {
              const completedTool = {
                ...currentTool,
                output: block.content,
              }
              toolCalls.push(completedTool)
              currentTool = null
              await callbacks.onMessage({
                type: 'tool_result',
                tool: completedTool.name,
                output: typeof block.content === 'string'
                  ? block.content.slice(0, 500)
                  : JSON.stringify(block.content).slice(0, 500),
                isError: block.is_error || false,
              })
            }
          }
        }
        break

      case 'result':
        await callbacks.onMessage({
          type: 'result',
          subtype: message.subtype,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
        })
        break
    }
  }

  return { claudeSessionId, fullContent, toolCalls }
}
```

**Step 2: Create SSE streaming endpoint**

Create `server/api/claude.post.ts`:
```typescript
import { runClaude } from '~/server/utils/claude'
import { db } from '~/server/utils/db'
import { messages, sessions } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { prompt, sessionId } = await readBody<{
    prompt: string
    sessionId: string
  }>(event)

  if (!prompt || !sessionId) {
    throw createError({ statusCode: 400, message: 'prompt and sessionId required' })
  }

  // Save user message
  await db.insert(messages).values({
    sessionId,
    role: 'user',
    content: prompt,
  })

  // Look up existing Claude session ID for resumption
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  })

  const eventStream = createEventStream(event)

  // Run Claude in background, stream results
  const claudePromise = runClaude(prompt, {
    onMessage: async (data) => {
      await eventStream.push(JSON.stringify(data))
    },
  }, {
    sessionId: session?.claudeSessionId || undefined,
  })

  claudePromise
    .then(async ({ claudeSessionId, fullContent, toolCalls }) => {
      // Save assistant message
      await db.insert(messages).values({
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls,
      })

      // Update session with Claude session ID and title
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }
      if (claudeSessionId) {
        updateData.claudeSessionId = claudeSessionId
      }
      if (!session?.title || session.title === 'New Chat') {
        updateData.title = prompt.slice(0, 80)
      }
      await db.update(sessions).set(updateData).where(eq(sessions.id, sessionId))

      await eventStream.push(JSON.stringify({ type: 'done' }))
      await eventStream.close()
    })
    .catch(async (err) => {
      await eventStream.push(JSON.stringify({ type: 'error', message: String(err) }))
      await eventStream.close()
    })

  eventStream.onClosed(async () => {
    // Cleanup if client disconnects
  })

  return eventStream.send()
})
```

**Step 3: Commit**

```bash
git add server/utils/claude.ts server/api/claude.post.ts
git commit -m "feat: add Claude Code SSE streaming endpoint"
```

---

### Task 5: Chat Composable

**Files:**
- Create: `composables/useChat.ts`
- Create: `types/index.ts`

**Step 1: Create shared types**

Create `types/index.ts`:
```typescript
export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  createdAt?: string
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  output?: unknown
  isError?: boolean
}

export interface StreamEvent {
  type: 'system' | 'text' | 'tool_call' | 'tool_result' | 'result' | 'done' | 'error'
  content?: string
  tool?: string
  input?: unknown
  output?: string
  isError?: boolean
  sessionId?: string
  cost?: number
  duration?: number
  message?: string
  subtype?: string
}

export interface Session {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  messages?: ChatMessage[]
}

export interface ScheduledJob {
  id: string
  name: string
  prompt: string
  cron: string
  enabled: boolean
  oneOff: boolean
  lastRun: string | null
  lastStatus: 'success' | 'error' | null
  lastOutput: string | null
  nextRun: string | null
  createdAt: string
}
```

**Step 2: Create chat composable**

Create `composables/useChat.ts`:
```typescript
import type { ChatMessage, StreamEvent, ToolCall } from '~/types'

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentSessionId = ref<string | null>(null)
  const activeTools = ref<ToolCall[]>([])

  async function createSession(): Promise<string> {
    const session = await $fetch('/api/sessions', { method: 'POST', body: {} })
    currentSessionId.value = session.id
    messages.value = []
    return session.id
  }

  async function loadSession(sessionId: string) {
    const session = await $fetch(`/api/sessions/${sessionId}`)
    currentSessionId.value = session.id
    messages.value = (session.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls || [],
      createdAt: m.createdAt,
    }))
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isStreaming.value) return

    let sessionId = currentSessionId.value
    if (!sessionId) {
      sessionId = await createSession()
    }

    messages.value.push({ role: 'user', content: prompt })
    isStreaming.value = true
    activeTools.value = []

    const assistantMessage: ChatMessage = { role: 'assistant', content: '', toolCalls: [] }
    messages.value.push(assistantMessage)

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: StreamEvent = JSON.parse(line)
            handleStreamEvent(event, assistantMessage)
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: StreamEvent = JSON.parse(buffer)
          handleStreamEvent(event, assistantMessage)
        } catch {
          // skip
        }
      }
    } catch (err) {
      assistantMessage.content += `\n\nError: ${err}`
    } finally {
      isStreaming.value = false
      activeTools.value = []
    }
  }

  function handleStreamEvent(event: StreamEvent, message: ChatMessage) {
    switch (event.type) {
      case 'text':
        message.content += event.content || ''
        break
      case 'tool_call':
        activeTools.value.push({
          name: event.tool || 'unknown',
          input: (event.input as Record<string, unknown>) || {},
        })
        break
      case 'tool_result': {
        const tool = activeTools.value.find((t) => t.name === event.tool && !t.output)
        if (tool) {
          tool.output = event.output
          tool.isError = event.isError
          message.toolCalls = [...(message.toolCalls || []), { ...tool }]
        }
        activeTools.value = activeTools.value.filter((t) => t.output === undefined)
        break
      }
      case 'error':
        message.content += `\n\nError: ${event.message}`
        break
    }
  }

  return {
    messages,
    isStreaming,
    currentSessionId,
    activeTools,
    createSession,
    loadSession,
    sendMessage,
  }
}
```

**Step 3: Commit**

```bash
git add types/ composables/
git commit -m "feat: add types and chat composable with SSE streaming"
```

---

### Task 6: Chat UI Components

**Files:**
- Create: `components/chat/ChatInput.vue`
- Create: `components/chat/MessageList.vue`
- Create: `components/chat/ToolExecution.vue`
- Create: `components/chat/MessageBubble.vue`

**Step 1: Create ChatInput component**

Create `components/chat/ChatInput.vue`:
```vue
<script setup lang="ts">
const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')
const textarea = ref<HTMLTextAreaElement>()

function submit() {
  if (!input.value.trim() || props.disabled) return
  emit('send', input.value.trim())
  input.value = ''
  nextTick(() => resize())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function resize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
</script>

<template>
  <div class="chat-input">
    <textarea
      ref="textarea"
      v-model="input"
      :disabled="disabled"
      placeholder="Send a message..."
      rows="1"
      @keydown="onKeydown"
      @input="resize"
    />
    <button
      :disabled="!input.trim() || disabled"
      @click="submit"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
}

textarea {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

textarea:focus {
  border-color: var(--accent);
}

textarea::placeholder {
  color: var(--text-dim);
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: var(--bg-primary);
  transition: opacity 0.15s;
}

button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  opacity: 0.85;
}
</style>
```

**Step 2: Create ToolExecution component**

Create `components/chat/ToolExecution.vue`:
```vue
<script setup lang="ts">
import type { ToolCall } from '~/types'

defineProps<{
  tool: ToolCall
}>()

const expanded = ref(false)
</script>

<template>
  <div class="tool-execution" @click="expanded = !expanded">
    <div class="tool-header">
      <svg
        class="chevron"
        :class="{ expanded }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span class="tool-name">{{ tool.name }}</span>
      <span v-if="tool.isError" class="tool-error">failed</span>
    </div>
    <div v-if="expanded" class="tool-details">
      <div v-if="tool.input && Object.keys(tool.input).length" class="tool-section">
        <div class="tool-label">Input</div>
        <pre>{{ JSON.stringify(tool.input, null, 2) }}</pre>
      </div>
      <div v-if="tool.output" class="tool-section">
        <div class="tool-label">Output</div>
        <pre>{{ typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-execution {
  margin: 4px 0;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  cursor: pointer;
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.chevron {
  transition: transform 0.15s;
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.tool-name {
  font-family: var(--font-mono);
  color: var(--accent);
}

.tool-error {
  color: var(--error);
  font-size: 11px;
}

.tool-details {
  border-top: 1px solid var(--border);
  padding: 8px 10px;
}

.tool-section {
  margin-bottom: 8px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.tool-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

pre {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
</style>
```

**Step 3: Create MessageBubble component**

Create `components/chat/MessageBubble.vue`:
```vue
<script setup lang="ts">
import type { ChatMessage } from '~/types'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div class="message" :class="message.role">
    <div class="message-content">
      <div class="message-text">{{ message.content }}</div>
      <div v-if="message.toolCalls?.length" class="tool-calls">
        <ChatToolExecution
          v-for="(tool, i) in message.toolCalls"
          :key="i"
          :tool="tool"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  padding: 4px 24px;
}

.message.user {
  justify-content: flex-end;
}

.message-content {
  max-width: 75%;
  min-width: 0;
}

.message.user .message-content {
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 16px 16px 4px 16px;
  padding: 10px 16px;
}

.message.assistant .message-content {
  padding: 10px 0;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.message.user .message-text {
  font-size: 14px;
}

.message.assistant .message-text {
  font-size: 14px;
  color: var(--text-primary);
}

.tool-calls {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
```

**Step 4: Create MessageList component**

Create `components/chat/MessageList.vue`:
```vue
<script setup lang="ts">
import type { ChatMessage, ToolCall } from '~/types'

const props = defineProps<{
  messages: ChatMessage[]
  activeTools: ToolCall[]
  isStreaming: boolean
}>()

const container = ref<HTMLElement>()

function scrollToBottom() {
  nextTick(() => {
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.messages[props.messages.length - 1]?.content, scrollToBottom)
watch(() => props.activeTools.length, scrollToBottom)

onMounted(scrollToBottom)
</script>

<template>
  <div ref="container" class="message-list">
    <div v-if="!messages.length" class="empty-state">
      <div class="empty-icon">~</div>
      <div class="empty-text">Start a conversation</div>
    </div>
    <ChatMessageBubble
      v-for="(msg, i) in messages"
      :key="i"
      :message="msg"
    />
    <div v-if="activeTools.length" class="active-tools">
      <ChatToolExecution
        v-for="(tool, i) in activeTools"
        :key="i"
        :tool="tool"
      />
    </div>
    <div v-if="isStreaming" class="streaming-indicator">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
}

.empty-icon {
  font-family: var(--font-mono);
  font-size: 32px;
  color: var(--accent);
  opacity: 0.4;
}

.empty-text {
  font-size: 15px;
}

.active-tools {
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.streaming-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 24px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.4;
  animation: pulse 1.4s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.4; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>
```

**Step 5: Commit**

```bash
git add components/chat/
git commit -m "feat: add chat UI components"
```

---

### Task 7: Chat Page & Session Drawer

**Files:**
- Create: `components/SessionDrawer.vue`
- Create: `pages/index.vue`
- Modify: `app.vue`

**Step 1: Create SessionDrawer component**

Create `components/SessionDrawer.vue`:
```vue
<script setup lang="ts">
import type { Session } from '~/types'

const props = defineProps<{
  open: boolean
  sessions: Session[]
  activeId: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  create: []
  delete: [id: string]
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-overlay" @click.self="emit('close')">
        <div class="drawer">
          <div class="drawer-header">
            <span>Sessions</span>
            <button class="btn-new" @click="emit('create')">+ New</button>
          </div>
          <div class="drawer-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === activeId }"
              @click="emit('select', session.id)"
            >
              <div class="session-title">{{ session.title || 'New Chat' }}</div>
              <button
                class="btn-delete"
                @click.stop="emit('delete', session.id)"
              >
                &times;
              </button>
            </div>
            <div v-if="!sessions.length" class="empty">No sessions yet</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 500;
}

.btn-new {
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.2);
  color: var(--accent);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.btn-new:hover {
  background: var(--accent-hover);
}

.drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.session-item:hover {
  background: var(--bg-elevated);
}

.session-item.active {
  background: var(--accent-dim);
}

.session-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 18px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.1s;
}

.session-item:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  color: var(--error);
}

.empty {
  text-align: center;
  padding: 24px;
  color: var(--text-dim);
  font-size: 13px;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.2s;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(-100%);
}
</style>
```

**Step 2: Create chat page**

Create `pages/index.vue`:
```vue
<script setup lang="ts">
import type { Session } from '~/types'

const { messages, isStreaming, currentSessionId, activeTools, sendMessage, loadSession, createSession } = useChat()

const drawerOpen = ref(false)
const sessions = ref<Session[]>([])

async function fetchSessions() {
  sessions.value = await $fetch('/api/sessions')
}

async function onSelectSession(id: string) {
  await loadSession(id)
  drawerOpen.value = false
}

async function onNewSession() {
  await createSession()
  await fetchSessions()
  drawerOpen.value = false
}

async function onDeleteSession(id: string) {
  await $fetch(`/api/sessions/${id}`, { method: 'DELETE' })
  if (currentSessionId.value === id) {
    currentSessionId.value = null
    messages.value = []
  }
  await fetchSessions()
}

function openDrawer() {
  fetchSessions()
  drawerOpen.value = true
}

onMounted(fetchSessions)
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="btn-menu" @click="openDrawer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="header-title">Remote Claude Code</span>
      <NuxtLink to="/dashboard" class="btn-dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </NuxtLink>
    </header>

    <ChatMessageList
      :messages="messages"
      :active-tools="activeTools"
      :is-streaming="isStreaming"
    />

    <ChatChatInput
      :disabled="isStreaming"
      @send="sendMessage"
    />

    <SessionDrawer
      :open="drawerOpen"
      :sessions="sessions"
      :active-id="currentSessionId"
      @close="drawerOpen = false"
      @select="onSelectSession"
      @create="onNewSession"
      @delete="onDeleteSession"
    />
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-menu,
.btn-dashboard {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.btn-menu:hover,
.btn-dashboard:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}
</style>
```

**Step 3: Update app.vue**

Replace `app.vue` with:
```vue
<template>
  <NuxtPage />
</template>
```

**Step 4: Commit**

```bash
git add components/SessionDrawer.vue pages/index.vue app.vue
git commit -m "feat: add chat page with session drawer"
```

---

### Task 8: Scheduled Jobs API Routes

**Files:**
- Create: `server/api/jobs/index.get.ts`
- Create: `server/api/jobs/index.post.ts`
- Create: `server/api/jobs/[id].put.ts`
- Create: `server/api/jobs/[id].delete.ts`

**Step 1: List jobs**

Create `server/api/jobs/index.get.ts`:
```typescript
import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return await db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt))
})
```

**Step 2: Create job**

Create `server/api/jobs/index.post.ts`:
```typescript
import { db } from '~/server/utils/db'
import { scheduledJobs } from '~/server/db/schema'
import { registerJob } from '~/server/utils/scheduler'

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
```

**Step 3: Update job**

Create `server/api/jobs/[id].put.ts`:
```typescript
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
```

**Step 4: Delete job**

Create `server/api/jobs/[id].delete.ts`:
```typescript
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
```

**Step 5: Commit**

```bash
git add server/api/jobs/
git commit -m "feat: add scheduled jobs CRUD API routes"
```

---

### Task 9: Scheduler System

**Files:**
- Create: `server/utils/scheduler.ts`
- Create: `server/plugins/scheduler.ts`

**Step 1: Create scheduler utility**

Create `server/utils/scheduler.ts`:
```typescript
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
```

**Step 2: Create scheduler plugin**

Create `server/plugins/scheduler.ts`:
```typescript
import { initScheduler } from '~/server/utils/scheduler'

export default defineNitroPlugin(async () => {
  await initScheduler()
})
```

**Step 3: Commit**

```bash
git add server/utils/scheduler.ts server/plugins/scheduler.ts
git commit -m "feat: add node-cron scheduler system"
```

---

### Task 10: Dashboard Page

**Files:**
- Create: `components/dashboard/JobList.vue`
- Create: `components/dashboard/JobForm.vue`
- Create: `pages/dashboard.vue`

**Step 1: Create JobForm component**

Create `components/dashboard/JobForm.vue`:
```vue
<script setup lang="ts">
import type { ScheduledJob } from '~/types'

const props = defineProps<{
  job?: ScheduledJob | null
}>()

const emit = defineEmits<{
  save: [data: { name: string; prompt: string; cron: string; oneOff: boolean }]
  cancel: []
}>()

const name = ref(props.job?.name || '')
const prompt = ref(props.job?.prompt || '')
const cronExpr = ref(props.job?.cron || '0 9 * * 1')
const oneOff = ref(props.job?.oneOff || false)

function submit() {
  if (!name.value.trim() || !prompt.value.trim() || !cronExpr.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    prompt: prompt.value.trim(),
    cron: cronExpr.value.trim(),
    oneOff: oneOff.value,
  })
}
</script>

<template>
  <div class="job-form">
    <div class="field">
      <label>Name</label>
      <input v-model="name" placeholder="Weekly calendar summary" />
    </div>
    <div class="field">
      <label>Prompt</label>
      <textarea v-model="prompt" rows="4" placeholder="Summarize my calendar for this week..." />
    </div>
    <div class="field">
      <label>Cron Expression</label>
      <input v-model="cronExpr" placeholder="0 9 * * 1" class="mono" />
      <div class="hint">e.g. "0 9 * * 1" = every Monday at 9am</div>
    </div>
    <div class="field-row">
      <label class="toggle">
        <input type="checkbox" v-model="oneOff" />
        <span>One-off (disable after first run)</span>
      </label>
    </div>
    <div class="actions">
      <button class="btn-cancel" @click="emit('cancel')">Cancel</button>
      <button class="btn-save" @click="submit">Save</button>
    </div>
  </div>
</template>

<style scoped>
.job-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input, textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, textarea:focus {
  border-color: var(--accent);
}

input.mono {
  font-family: var(--font-mono);
}

textarea {
  resize: vertical;
}

.hint {
  font-size: 12px;
  color: var(--text-dim);
}

.field-row {
  display: flex;
  align-items: center;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: 0;
}

.toggle input {
  accent-color: var(--accent);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.btn-cancel:hover {
  background: var(--bg-elevated);
}

.btn-save {
  background: var(--accent);
  border: none;
  color: var(--bg-primary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.btn-save:hover {
  opacity: 0.85;
}
</style>
```

**Step 2: Create JobList component**

Create `components/dashboard/JobList.vue`:
```vue
<script setup lang="ts">
import type { ScheduledJob } from '~/types'

defineProps<{
  jobs: ScheduledJob[]
}>()

const emit = defineEmits<{
  edit: [job: ScheduledJob]
  toggle: [job: ScheduledJob]
  delete: [id: string]
}>()

const expandedId = ref<string | null>(null)

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}
</script>

<template>
  <div class="job-list">
    <div v-if="!jobs.length" class="empty">
      No scheduled jobs yet
    </div>
    <div
      v-for="job in jobs"
      :key="job.id"
      class="job-card"
    >
      <div class="job-row" @click="toggle(job.id)">
        <div class="job-info">
          <div class="job-name">{{ job.name }}</div>
          <div class="job-cron">{{ job.cron }}</div>
        </div>
        <div class="job-meta">
          <span
            v-if="job.lastStatus"
            class="status"
            :class="job.lastStatus"
          >
            {{ job.lastStatus }}
          </span>
          <span
            class="enabled-badge"
            :class="{ active: job.enabled }"
          >
            {{ job.enabled ? 'on' : 'off' }}
          </span>
        </div>
      </div>
      <div v-if="expandedId === job.id" class="job-details">
        <div class="detail-row">
          <span class="detail-label">Prompt</span>
          <span class="detail-value">{{ job.prompt }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last run</span>
          <span class="detail-value">{{ formatDate(job.lastRun) }}</span>
        </div>
        <div v-if="job.lastOutput" class="detail-row">
          <span class="detail-label">Last output</span>
          <pre class="detail-output">{{ job.lastOutput }}</pre>
        </div>
        <div class="detail-actions">
          <button class="btn-action" @click="emit('toggle', job)">
            {{ job.enabled ? 'Disable' : 'Enable' }}
          </button>
          <button class="btn-action" @click="emit('edit', job)">Edit</button>
          <button class="btn-action danger" @click="emit('delete', job.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.job-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty {
  text-align: center;
  padding: 48px;
  color: var(--text-dim);
}

.job-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.job-row:hover {
  background: var(--bg-elevated);
}

.job-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.job-name {
  font-size: 14px;
  font-weight: 500;
}

.job-cron {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
}

.job-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status.success {
  color: var(--success);
  background: rgba(74, 222, 128, 0.1);
}

.status.error {
  color: var(--error);
  background: rgba(248, 113, 113, 0.1);
}

.enabled-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--text-dim);
  background: var(--bg-primary);
}

.enabled-badge.active {
  color: var(--accent);
  background: var(--accent-dim);
}

.job-details {
  border-top: 1px solid var(--border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-output {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
  padding: 8px;
  border-radius: 6px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.btn-action {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.1s;
}

.btn-action:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn-action.danger:hover {
  border-color: var(--error);
  color: var(--error);
}
</style>
```

**Step 3: Create dashboard page**

Create `pages/dashboard.vue`:
```vue
<script setup lang="ts">
import type { ScheduledJob } from '~/types'

const jobs = ref<ScheduledJob[]>([])
const showForm = ref(false)
const editingJob = ref<ScheduledJob | null>(null)

async function fetchJobs() {
  jobs.value = await $fetch('/api/jobs')
}

async function onSave(data: { name: string; prompt: string; cron: string; oneOff: boolean }) {
  if (editingJob.value) {
    await $fetch(`/api/jobs/${editingJob.value.id}`, {
      method: 'PUT',
      body: data,
    })
  } else {
    await $fetch('/api/jobs', {
      method: 'POST',
      body: data,
    })
  }
  showForm.value = false
  editingJob.value = null
  await fetchJobs()
}

function onEdit(job: ScheduledJob) {
  editingJob.value = job
  showForm.value = true
}

async function onToggle(job: ScheduledJob) {
  await $fetch(`/api/jobs/${job.id}`, {
    method: 'PUT',
    body: { enabled: !job.enabled },
  })
  await fetchJobs()
}

async function onDelete(id: string) {
  await $fetch(`/api/jobs/${id}`, { method: 'DELETE' })
  await fetchJobs()
}

function onCancel() {
  showForm.value = false
  editingJob.value = null
}

onMounted(fetchJobs)
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <NuxtLink to="/" class="btn-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </NuxtLink>
      <span class="header-title">Scheduled Jobs</span>
      <button class="btn-add" @click="showForm = true; editingJob = null">
        + New Job
      </button>
    </header>

    <div class="dashboard-content">
      <DashboardJobForm
        v-if="showForm"
        :job="editingJob"
        @save="onSave"
        @cancel="onCancel"
      />
      <DashboardJobList
        :jobs="jobs"
        @edit="onEdit"
        @toggle="onToggle"
        @delete="onDelete"
      />
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.btn-back:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-add {
  background: var(--accent);
  border: none;
  color: var(--bg-primary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.btn-add:hover {
  opacity: 0.85;
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
```

**Step 4: Commit**

```bash
git add components/dashboard/ pages/dashboard.vue
git commit -m "feat: add dashboard page with job management"
```

---

### Task 11: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
FROM node:20-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

**Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      # Mount Obsidian vault — adjust path to your vault
      - /path/to/obsidian/vault:/data/obsidian
      # Mount Claude Code config
      - ~/.claude:/root/.claude
    restart: unless-stopped
    network_mode: host
```

**Step 3: Create .dockerignore**

Create `.dockerignore`:
```
node_modules
.nuxt
.output
.git
.env
```

**Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker setup"
```

---

### Task 12: Integration Test — End to End

**Step 1: Set up .env with real credentials**

Create `.env` from `.env.example` with actual DATABASE_URL and ANTHROPIC_API_KEY.

**Step 2: Run migrations**

Run:
```bash
npx drizzle-kit push
```

Expected: Tables created in PostgreSQL.

**Step 3: Start dev server**

Run:
```bash
npm run dev
```

Expected: Nuxt dev server starts on http://localhost:3000.

**Step 4: Manual smoke test**

- Open http://localhost:3000 — chat page loads with dark theme and empty state
- Type a message and send — SSE streams Claude Code response with tool visualization
- Click menu icon — session drawer opens showing the session
- Navigate to /dashboard — dashboard loads
- Create a scheduled job — job appears in list
- Return to chat — previous session accessible from drawer

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```
