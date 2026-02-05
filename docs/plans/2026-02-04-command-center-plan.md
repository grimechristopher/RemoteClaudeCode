# Command Center v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform RemoteClaudeCode from a basic chat app into a personal AI command center with an interleaved activity feed, enriched tool events, system prompts, sandboxed Docker execution, and mobile-friendly UI.

**Architecture:** Enrich the existing SSE stream in `server/utils/claude.ts` with tool categories/summaries, switch the frontend from "tool calls nested inside messages" to a flat interleaved feed of text + tool items, add per-session system prompts, and harden the Docker container with proper volume scoping.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, @anthropic-ai/claude-agent-sdk, Drizzle ORM, PostgreSQL, node-cron, Docker

---

### Task 1: Update Types for Feed Items

**Files:**
- Modify: `app/types/index.ts`

**Step 1: Replace types file with feed-aware types**

Replace the entire contents of `app/types/index.ts` with:

```typescript
export interface FeedItem {
  type: 'user' | 'text' | 'tool_call' | 'tool_result' | 'result' | 'error'
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  summary?: string
  category?: 'filesystem' | 'calendar' | 'web' | 'command' | 'search' | 'other'
  isError?: boolean
  cost?: number
  duration?: number
  timestamp: string
}

export interface StreamEvent {
  type: 'system' | 'text' | 'tool_call' | 'tool_result' | 'result' | 'done' | 'error'
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  summary?: string
  category?: string
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
  systemPrompt: string | null
  createdAt: string
  updatedAt: string
  messages?: DbMessage[]
}

export interface DbMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  feedItems?: FeedItem[]
  createdAt: string
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  output?: unknown
  isError?: boolean
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

**Step 2: Verify no TypeScript errors**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npx nuxi typecheck`

Expected: May show errors in files that still reference old `ChatMessage` type — that's fine, we'll fix those in later tasks.

**Step 3: Commit**

```bash
git add app/types/index.ts
git commit -m "feat: update types for interleaved feed items"
```

---

### Task 2: Add Database Columns

**Files:**
- Modify: `server/db/schema.ts`

**Step 1: Add `systemPrompt` to sessions and `feedItems` to messages**

In `server/db/schema.ts`, add `systemPrompt` column to the `sessions` table definition. After the existing `claudeSessionId` line:

```typescript
  systemPrompt: text('system_prompt'),
```

In the `messages` table definition, after the existing `toolCalls` column:

```typescript
  feedItems: jsonb('feed_items').$type<Array<{
    type: 'user' | 'text' | 'tool_call' | 'tool_result' | 'result' | 'error'
    content?: string
    tool?: string
    input?: Record<string, unknown>
    output?: string
    summary?: string
    category?: string
    isError?: boolean
    cost?: number
    duration?: number
    timestamp: string
  }>>().default([]),
```

**Step 2: Generate migration**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npx drizzle-kit generate`

Expected: New migration SQL file created in `server/db/migrations/`.

**Step 3: Push migration to database**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npx drizzle-kit push`

Expected: Schema synced to PostgreSQL.

**Step 4: Commit**

```bash
git add server/db/schema.ts server/db/migrations/
git commit -m "feat: add systemPrompt and feedItems columns"
```

---

### Task 3: Add Tool Categorization Utility

**Files:**
- Create: `server/utils/tools.ts`

**Step 1: Create the tool categorization helper**

Create `server/utils/tools.ts`:

```typescript
type ToolCategory = 'filesystem' | 'calendar' | 'web' | 'command' | 'search' | 'other'

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  Read: 'filesystem',
  Write: 'filesystem',
  Edit: 'filesystem',
  Glob: 'filesystem',
  Grep: 'search',
  Bash: 'command',
  WebFetch: 'web',
  WebSearch: 'search',
  NotebookEdit: 'filesystem',
}

export function categorize(toolName: string): ToolCategory {
  return TOOL_CATEGORIES[toolName] || 'other'
}

export function summarize(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return `Reading ${input.file_path || 'file'}`
    case 'Write':
      return `Writing ${input.file_path || 'file'}`
    case 'Edit':
      return `Editing ${input.file_path || 'file'}`
    case 'Glob':
      return `Finding files: ${input.pattern || ''}`
    case 'Grep':
      return `Searching for "${input.pattern || ''}"${input.path ? ` in ${input.path}` : ''}`
    case 'Bash': {
      const cmd = String(input.command || '')
      return `Running: ${cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd}`
    }
    case 'WebFetch':
      return `Fetching ${input.url || 'URL'}`
    case 'WebSearch':
      return `Searching: "${input.query || ''}"`
    case 'NotebookEdit':
      return `Editing notebook ${input.notebook_path || ''}`
    default:
      return `${toolName}`
  }
}
```

**Step 2: Commit**

```bash
git add server/utils/tools.ts
git commit -m "feat: add tool categorization and summarization utility"
```

---

### Task 4: Enrich the Claude SSE Stream

**Files:**
- Modify: `server/utils/claude.ts`

**Step 1: Replace `server/utils/claude.ts` with enriched version**

Replace the entire contents of `server/utils/claude.ts`:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

interface FeedItem {
  type: 'text' | 'tool_call' | 'tool_result' | 'result' | 'error'
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  summary?: string
  category?: string
  isError?: boolean
  cost?: number
  duration?: number
  timestamp: string
}

export interface ClaudeStreamCallbacks {
  onMessage: (data: Record<string, unknown>) => Promise<void>
}

export async function runClaude(
  prompt: string,
  callbacks: ClaudeStreamCallbacks,
  options?: { sessionId?: string; cwd?: string; systemPrompt?: string },
) {
  const queryOptions: Record<string, unknown> = {
    permissionMode: 'bypassPermissions',
    cwd: options?.cwd || process.cwd(),
  }
  if (options?.sessionId) {
    queryOptions.resume = options.sessionId
  }
  if (options?.systemPrompt) {
    queryOptions.systemPrompt = options.systemPrompt
  }

  const claudeQuery = query({
    prompt,
    options: queryOptions as any,
  })

  let claudeSessionId: string | undefined
  let fullContent = ''
  const toolCalls: Array<{ name: string; input: Record<string, unknown>; output?: unknown }> = []
  const feedItems: FeedItem[] = []
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
              const item: FeedItem = {
                type: 'text',
                content: block.text,
                timestamp: new Date().toISOString(),
              }
              feedItems.push(item)
              await callbacks.onMessage({
                type: 'text',
                content: block.text,
              })
            } else if (block.type === 'tool_use') {
              currentTool = { name: block.name, input: block.input as Record<string, unknown> }
              const cat = categorize(block.name)
              const sum = summarize(block.name, block.input as Record<string, unknown>)
              const item: FeedItem = {
                type: 'tool_call',
                tool: block.name,
                input: block.input as Record<string, unknown>,
                category: cat,
                summary: sum,
                timestamp: new Date().toISOString(),
              }
              feedItems.push(item)
              await callbacks.onMessage({
                type: 'tool_call',
                tool: block.name,
                input: block.input,
                category: cat,
                summary: sum,
              })
            }
          }
        }
        break

      case 'user':
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'tool_result' && currentTool) {
              const outputStr = typeof block.content === 'string'
                ? block.content.slice(0, 2000)
                : JSON.stringify(block.content).slice(0, 2000)
              const completedTool = {
                ...currentTool,
                output: block.content,
              }
              toolCalls.push(completedTool)
              const item: FeedItem = {
                type: 'tool_result',
                tool: currentTool.name,
                output: outputStr,
                isError: block.is_error || false,
                timestamp: new Date().toISOString(),
              }
              feedItems.push(item)
              currentTool = null
              await callbacks.onMessage({
                type: 'tool_result',
                tool: completedTool.name,
                output: outputStr,
                isError: block.is_error || false,
              })
            }
          }
        }
        break

      case 'result': {
        const item: FeedItem = {
          type: 'result',
          cost: message.total_cost_usd,
          duration: message.duration_ms,
          timestamp: new Date().toISOString(),
        }
        feedItems.push(item)
        await callbacks.onMessage({
          type: 'result',
          subtype: message.subtype,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
        })
        break
      }
    }
  }

  return { claudeSessionId, fullContent, toolCalls, feedItems }
}
```

Note: `categorize` and `summarize` are auto-imported from `server/utils/tools.ts` by Nitro.

**Step 2: Commit**

```bash
git add server/utils/claude.ts
git commit -m "feat: enrich Claude SSE stream with categories and summaries"
```

---

### Task 5: Update Claude API Endpoint to Store Feed Items and Support System Prompts

**Files:**
- Modify: `server/api/claude.post.ts`

**Step 1: Replace `server/api/claude.post.ts`**

Replace the entire contents:

```typescript
import { messages, sessions } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { prompt, sessionId } = await readBody<{
    prompt: string
    sessionId: string
  }>(event)

  if (!prompt || !sessionId) {
    throw createError({ statusCode: 400, message: 'prompt and sessionId required' })
  }

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

  const eventStream = createEventStream(event)

  const claudePromise = runClaude(prompt, {
    onMessage: async (data) => {
      await eventStream.push(JSON.stringify(data))
    },
  }, {
    sessionId: session?.claudeSessionId || undefined,
    systemPrompt: session?.systemPrompt || undefined,
  })

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

**Step 2: Commit**

```bash
git add server/api/claude.post.ts
git commit -m "feat: store feed items and pass system prompts to Claude"
```

---

### Task 6: Add System Prompt API Support

**Files:**
- Modify: `server/api/sessions/index.post.ts`
- Create: `server/api/sessions/[id].patch.ts`

**Step 1: Update session creation to accept systemPrompt**

Replace `server/api/sessions/index.post.ts`:

```typescript
import { sessions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [session] = await db.insert(sessions).values({
    title: body.title || 'New Chat',
    systemPrompt: body.systemPrompt || null,
  }).returning()
  return session
})
```

**Step 2: Create PATCH endpoint for updating session system prompt**

Create `server/api/sessions/[id].patch.ts`:

```typescript
import { sessions } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }
  if (body.systemPrompt !== undefined) {
    updateData.systemPrompt = body.systemPrompt
  }
  if (body.title !== undefined) {
    updateData.title = body.title
  }

  const [updated] = await db.update(sessions)
    .set(updateData)
    .where(eq(sessions.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  return updated
})
```

**Step 3: Commit**

```bash
git add server/api/sessions/index.post.ts server/api/sessions/\[id\].patch.ts
git commit -m "feat: add system prompt support to session API"
```

---

### Task 7: Rewrite Chat Composable for Feed Model

**Files:**
- Modify: `app/composables/useChat.ts`

**Step 1: Replace composable with feed-based version**

Replace the entire contents of `app/composables/useChat.ts`:

```typescript
import type { FeedItem, StreamEvent, DbMessage, ToolCall } from '~/types'

export function useChat() {
  const feedItems = ref<FeedItem[]>([])
  const isStreaming = ref(false)
  const currentSessionId = ref<string | null>(null)
  const currentSystemPrompt = ref<string | null>(null)

  async function createSession(systemPrompt?: string): Promise<string> {
    const session = await $fetch('/api/sessions', {
      method: 'POST',
      body: { systemPrompt: systemPrompt || null },
    })
    currentSessionId.value = session.id
    currentSystemPrompt.value = session.systemPrompt || null
    feedItems.value = []
    return session.id
  }

  async function loadSession(sessionId: string) {
    const session = await $fetch(`/api/sessions/${sessionId}`)
    currentSessionId.value = session.id
    currentSystemPrompt.value = (session as any).systemPrompt || null

    // Rebuild feed from stored messages
    const items: FeedItem[] = []
    for (const msg of (session.messages || [])) {
      if (msg.feedItems?.length) {
        items.push(...msg.feedItems)
      } else {
        // Backward compat: old messages without feedItems
        if (msg.role === 'user') {
          items.push({ type: 'user', content: msg.content, timestamp: msg.createdAt })
        } else {
          items.push({ type: 'text', content: msg.content, timestamp: msg.createdAt })
          for (const tc of (msg.toolCalls || [])) {
            items.push({
              type: 'tool_call',
              tool: tc.name,
              input: tc.input,
              summary: tc.name,
              category: 'other',
              timestamp: msg.createdAt,
            })
            if (tc.output !== undefined) {
              items.push({
                type: 'tool_result',
                tool: tc.name,
                output: typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output),
                timestamp: msg.createdAt,
              })
            }
          }
        }
      }
    }
    feedItems.value = items
  }

  async function updateSystemPrompt(prompt: string | null) {
    if (!currentSessionId.value) return
    await $fetch(`/api/sessions/${currentSessionId.value}`, {
      method: 'PATCH',
      body: { systemPrompt: prompt },
    })
    currentSystemPrompt.value = prompt
  }

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isStreaming.value) return

    let sessionId = currentSessionId.value
    if (!sessionId) {
      sessionId = await createSession()
    }

    // Add user message to feed
    feedItems.value.push({
      type: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    })

    isStreaming.value = true

    // Track active tool calls (pending result)
    const pendingTools: { name: string; feedIndex: number }[] = []

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
      let currentTextIndex: number | null = null

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
            processEvent(event)
          } catch {
            // skip malformed
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event: StreamEvent = JSON.parse(buffer)
          processEvent(event)
        } catch {
          // skip
        }
      }

      function processEvent(event: StreamEvent) {
        const now = new Date().toISOString()
        switch (event.type) {
          case 'text':
            // Append to current text item or create new one
            if (currentTextIndex !== null && feedItems.value[currentTextIndex]?.type === 'text') {
              feedItems.value[currentTextIndex] = {
                ...feedItems.value[currentTextIndex],
                content: (feedItems.value[currentTextIndex].content || '') + (event.content || ''),
              }
            } else {
              currentTextIndex = feedItems.value.length
              feedItems.value.push({
                type: 'text',
                content: event.content || '',
                timestamp: now,
              })
            }
            break

          case 'tool_call':
            currentTextIndex = null
            pendingTools.push({ name: event.tool || 'unknown', feedIndex: feedItems.value.length })
            feedItems.value.push({
              type: 'tool_call',
              tool: event.tool || 'unknown',
              input: (event.input as Record<string, unknown>) || {},
              summary: event.summary || event.tool || 'unknown',
              category: (event.category as FeedItem['category']) || 'other',
              timestamp: now,
            })
            break

          case 'tool_result': {
            currentTextIndex = null
            feedItems.value.push({
              type: 'tool_result',
              tool: event.tool || 'unknown',
              output: event.output || '',
              isError: event.isError,
              timestamp: now,
            })
            // Remove from pending
            const idx = pendingTools.findIndex((t) => t.name === event.tool)
            if (idx !== -1) pendingTools.splice(idx, 1)
            break
          }

          case 'result':
            currentTextIndex = null
            feedItems.value.push({
              type: 'result',
              cost: event.cost,
              duration: event.duration,
              timestamp: now,
            })
            break

          case 'error':
            currentTextIndex = null
            feedItems.value.push({
              type: 'error',
              content: event.message || 'Unknown error',
              timestamp: now,
            })
            break
        }
      }
    } catch (err) {
      feedItems.value.push({
        type: 'error',
        content: String(err),
        timestamp: new Date().toISOString(),
      })
    } finally {
      isStreaming.value = false
    }
  }

  return {
    feedItems,
    isStreaming,
    currentSessionId,
    currentSystemPrompt,
    createSession,
    loadSession,
    sendMessage,
    updateSystemPrompt,
  }
}
```

**Step 2: Commit**

```bash
git add app/composables/useChat.ts
git commit -m "feat: rewrite chat composable for interleaved feed model"
```

---

### Task 8: Create FeedItem Component

**Files:**
- Create: `app/components/chat/FeedItem.vue`

**Step 1: Create the interleaved feed item component**

Create `app/components/chat/FeedItem.vue`:

```vue
<script setup lang="ts">
import type { FeedItem } from '~/types'

defineProps<{
  item: FeedItem
  isActive?: boolean
}>()

const expanded = ref(false)

function formatOutput(output: string): string {
  if (output.length > 300) {
    return output.slice(0, 300) + '...'
  }
  return output
}
</script>

<template>
  <!-- User message -->
  <div v-if="item.type === 'user'" class="feed-item user-msg">
    <div class="user-bubble">{{ item.content }}</div>
  </div>

  <!-- Claude text -->
  <div v-else-if="item.type === 'text'" class="feed-item claude-text">
    <div class="claude-content">{{ item.content }}</div>
  </div>

  <!-- Tool call -->
  <div v-else-if="item.type === 'tool_call'" class="feed-item tool-item" @click="expanded = !expanded">
    <div class="tool-header">
      <span class="tool-icon">
        <template v-if="item.category === 'filesystem'">&#128196;</template>
        <template v-else-if="item.category === 'command'">&#9654;</template>
        <template v-else-if="item.category === 'web'">&#127760;</template>
        <template v-else-if="item.category === 'search'">&#128269;</template>
        <template v-else-if="item.category === 'calendar'">&#128197;</template>
        <template v-else>&#9881;</template>
      </span>
      <span class="tool-summary">{{ item.summary || item.tool }}</span>
      <span v-if="isActive" class="tool-status spinning" />
      <svg
        class="chevron"
        :class="{ open: expanded }"
        width="12" height="12"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
    <div v-if="expanded && item.input && Object.keys(item.input).length" class="tool-details">
      <div class="detail-label">Input</div>
      <pre class="detail-pre">{{ JSON.stringify(item.input, null, 2) }}</pre>
    </div>
  </div>

  <!-- Tool result -->
  <div v-else-if="item.type === 'tool_result'" class="feed-item tool-result-item" @click="expanded = !expanded">
    <div class="result-header">
      <span class="result-status" :class="{ error: item.isError }">
        {{ item.isError ? '&#10007;' : '&#10003;' }}
      </span>
      <span class="result-tool">{{ item.tool }}</span>
      <span class="result-summary">{{ item.output ? formatOutput(item.output).split('\n')[0] : '' }}</span>
      <svg
        class="chevron"
        :class="{ open: expanded }"
        width="12" height="12"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
    <div v-if="expanded && item.output" class="tool-details">
      <div class="detail-label">Output</div>
      <pre class="detail-pre">{{ item.output }}</pre>
    </div>
  </div>

  <!-- Result (cost/duration) -->
  <div v-else-if="item.type === 'result'" class="feed-item result-info">
    <span v-if="item.cost !== undefined" class="result-meta">${{ item.cost?.toFixed(4) }}</span>
    <span v-if="item.duration !== undefined" class="result-meta">{{ (item.duration! / 1000).toFixed(1) }}s</span>
  </div>

  <!-- Error -->
  <div v-else-if="item.type === 'error'" class="feed-item error-item">
    <span class="error-icon">&#9888;</span>
    <span class="error-text">{{ item.content }}</span>
  </div>
</template>

<style scoped>
.feed-item {
  padding: 0 24px;
}

/* User message */
.user-msg {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  padding-bottom: 4px;
}

.user-bubble {
  max-width: 75%;
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 16px 16px 4px 16px;
  padding: 10px 16px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

/* Claude text */
.claude-text {
  padding-top: 4px;
  padding-bottom: 4px;
}

.claude-content {
  max-width: 85%;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: var(--text-primary);
}

/* Tool call */
.tool-item {
  padding-top: 2px;
  padding-bottom: 2px;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.1s;
}

.tool-header:hover {
  background: var(--bg-elevated);
}

.tool-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.tool-summary {
  flex: 1;
  font-family: var(--font-mono);
  color: var(--accent);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-status.spinning {
  width: 10px;
  height: 10px;
  border: 2px solid var(--accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chevron {
  transition: transform 0.15s;
  flex-shrink: 0;
  color: var(--text-dim);
}

.chevron.open {
  transform: rotate(90deg);
}

/* Tool result */
.tool-result-item {
  padding-top: 1px;
  padding-bottom: 2px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-top: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-dim);
  transition: background 0.1s;
}

.result-header:hover {
  background: var(--bg-elevated);
}

.result-status {
  font-size: 11px;
  color: var(--success);
}

.result-status.error {
  color: var(--error);
}

.result-tool {
  font-family: var(--font-mono);
  color: var(--text-dim);
  font-size: 11px;
}

.result-summary {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: var(--text-dim);
  font-size: 11px;
}

/* Shared details */
.tool-details {
  margin-top: 4px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.detail-pre {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  font-family: var(--font-mono);
}

/* Result info */
.result-info {
  display: flex;
  gap: 12px;
  padding-top: 4px;
  padding-bottom: 8px;
}

.result-meta {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

/* Error */
.error-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
  color: var(--error);
  font-size: 13px;
}

.error-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.error-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
```

**Step 2: Commit**

```bash
git add app/components/chat/FeedItem.vue
git commit -m "feat: create FeedItem component for interleaved activity feed"
```

---

### Task 9: Rewrite MessageList as Feed

**Files:**
- Modify: `app/components/chat/MessageList.vue`

**Step 1: Replace MessageList with feed-based version**

Replace the entire contents of `app/components/chat/MessageList.vue`:

```vue
<script setup lang="ts">
import type { FeedItem } from '~/types'

const props = defineProps<{
  items: FeedItem[]
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

watch(() => props.items.length, scrollToBottom)
watch(
  () => props.items[props.items.length - 1]?.content,
  scrollToBottom,
)

onMounted(scrollToBottom)
</script>

<template>
  <div ref="container" class="feed">
    <div v-if="!items.length" class="empty-state">
      <div class="empty-icon">~</div>
      <div class="empty-text">Start a conversation</div>
    </div>
    <ChatFeedItem
      v-for="(item, i) in items"
      :key="i"
      :item="item"
      :is-active="isStreaming && item.type === 'tool_call' && i === items.length - 1"
    />
    <div v-if="isStreaming && items[items.length - 1]?.type !== 'tool_call'" class="streaming-indicator">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </div>
  </div>
</template>

<style scoped>
.feed {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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

**Step 2: Commit**

```bash
git add app/components/chat/MessageList.vue
git commit -m "feat: rewrite MessageList as interleaved feed"
```

---

### Task 10: Update Chat Page

**Files:**
- Modify: `app/pages/index.vue`

**Step 1: Replace index.vue to use new feed composable**

Replace the entire contents of `app/pages/index.vue`:

```vue
<script setup lang="ts">
import type { Session } from '~/types'

const {
  feedItems,
  isStreaming,
  currentSessionId,
  currentSystemPrompt,
  sendMessage,
  loadSession,
  createSession,
  updateSystemPrompt,
} = useChat()

const drawerOpen = ref(false)
const sessions = ref<Session[]>([])
const showSystemPrompt = ref(false)
const systemPromptDraft = ref('')

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
    feedItems.value = []
  }
  await fetchSessions()
}

function openDrawer() {
  fetchSessions()
  drawerOpen.value = true
}

function openSystemPrompt() {
  systemPromptDraft.value = currentSystemPrompt.value || ''
  showSystemPrompt.value = true
}

async function saveSystemPrompt() {
  await updateSystemPrompt(systemPromptDraft.value || null)
  showSystemPrompt.value = false
}

onMounted(fetchSessions)
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="btn-icon" @click="openDrawer" title="Sessions">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="header-title">Remote Claude Code</span>
      <button
        v-if="currentSessionId"
        class="btn-icon"
        :class="{ active: currentSystemPrompt }"
        @click="openSystemPrompt"
        title="System Prompt"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
      <NuxtLink to="/dashboard" class="btn-icon" title="Dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </NuxtLink>
    </header>

    <ChatMessageList
      :items="feedItems"
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

    <!-- System Prompt Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSystemPrompt" class="modal-overlay" @click.self="showSystemPrompt = false">
          <div class="modal">
            <div class="modal-header">System Prompt</div>
            <textarea
              v-model="systemPromptDraft"
              class="modal-textarea"
              rows="6"
              placeholder="You are my personal assistant. You have access to my Obsidian vault at /data/notes and my Nextcloud calendar..."
            />
            <div class="modal-actions">
              <button class="btn-cancel" @click="showSystemPrompt = false">Cancel</button>
              <button class="btn-save" @click="saveSystemPrompt">Save</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-icon {
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
  text-decoration: none;
}

.btn-icon:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.btn-icon.active {
  border-color: var(--accent);
  color: var(--accent);
}

/* System Prompt Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  font-weight: 500;
  font-size: 15px;
}

.modal-textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.modal-textarea:focus {
  border-color: var(--accent);
}

.modal-textarea::placeholder {
  color: var(--text-dim);
}

.modal-actions {
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .chat-header {
    padding: 10px 12px;
  }

  .header-title {
    font-size: 14px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
  }
}
</style>
```

**Step 2: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: update chat page for feed model with system prompt support"
```

---

### Task 11: Clean Up Unused Components

**Files:**
- Delete: `app/components/chat/MessageBubble.vue`

**Step 1: Remove the old MessageBubble component**

Delete `app/components/chat/MessageBubble.vue` — it's replaced by `FeedItem.vue`.

Run: `rm /home/chris/Documents/Github/RemoteClaudeCode/app/components/chat/MessageBubble.vue`

**Step 2: Update ToolExecution.vue for standalone use**

The `ToolExecution.vue` component is still used by the dashboard's job output display. Leave it as-is — it may be useful later if the dashboard shows tool details. If nothing references it, delete it too.

Check: `grep -r "ToolExecution" /home/chris/Documents/Github/RemoteClaudeCode/app/`

If no references found outside of MessageBubble, also delete `app/components/chat/ToolExecution.vue`.

**Step 3: Commit**

```bash
git add -u app/components/chat/
git commit -m "chore: remove unused MessageBubble component"
```

---

### Task 12: Mobile-Responsive CSS Tweaks

**Files:**
- Modify: `app/assets/css/main.css`

**Step 1: Add mobile viewport and responsive rules**

Add the following to the end of `app/assets/css/main.css`:

```css

/* Mobile responsive */
@media (max-width: 640px) {
  html, body, #__nuxt {
    font-size: 13px;
  }

  ::-webkit-scrollbar {
    width: 3px;
  }
}

/* Safe area for notched phones */
@supports (padding-top: env(safe-area-inset-top)) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

**Step 2: Update viewport meta in nuxt.config.ts**

In `nuxt.config.ts`, replace the viewport meta tag:

Change:
```typescript
{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
```
To:
```typescript
{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1' },
```

Also add a theme-color meta and a manifest-friendly `<meta>`:

After the viewport line, add:
```typescript
{ name: 'theme-color', content: '#0a0a0a' },
{ name: 'apple-mobile-web-app-capable', content: 'yes' },
{ name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
```

**Step 3: Commit**

```bash
git add app/assets/css/main.css nuxt.config.ts
git commit -m "feat: add mobile responsive styles and PWA-friendly meta tags"
```

---

### Task 13: Update Docker Setup for Sandbox

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: Replace Dockerfile with sandbox-hardened version**

Replace the entire contents of `Dockerfile`:

```dockerfile
FROM node:20-slim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install git (Claude Code needs it)
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directories for mounts
RUN mkdir -p /data/notes /data/repos

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

**Step 2: Replace docker-compose.yml with proper sandbox volumes**

Replace the entire contents of `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      # Obsidian vault (read/write) — adjust path
      - ${NOTES_PATH:-/path/to/obsidian/vault}:/data/notes
      # Code repos (read/write) — adjust path
      - ${REPOS_PATH:-/path/to/repos}:/data/repos
      # Claude Code config and MCP servers
      - ${CLAUDE_CONFIG:-~/.claude}:/root/.claude
    restart: unless-stopped
    # Use host network for access to local services (Nextcloud, Postgres)
    # Remove this and use explicit ports if you want more isolation
    network_mode: host
```

**Step 3: Update .env.example with new variables**

Add the following lines to `.env.example` (read it first, append to it):

Run: Check current `.env.example` content, then append.

Append to `.env.example`:

```env

# Docker volume paths
NOTES_PATH=/path/to/obsidian/vault
REPOS_PATH=/path/to/code/repos
CLAUDE_CONFIG=~/.claude
```

**Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml .env.example
git commit -m "feat: harden Docker setup with sandbox volumes and git support"
```

---

### Task 14: Smoke Test

**Step 1: Verify the app builds**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npm run build`

Expected: Build completes without errors.

**Step 2: Fix any build errors**

If there are TypeScript or build errors, fix them. Common issues:
- Old `ChatMessage` references in components (should be `FeedItem` now)
- Missing `messages` / `activeTools` props passed to MessageList (now `items`)
- Import paths

**Step 3: Verify dev server starts**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npm run dev`

Expected: Dev server starts on http://localhost:3000.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from v2 refactor"
```

---

### Task 15: Run Database Migration

**Step 1: Push schema changes to database**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npx drizzle-kit push`

Expected: New columns (`system_prompt` on sessions, `feed_items` on messages) added to PostgreSQL.

**Step 2: Verify migration worked**

Run: `cd /home/chris/Documents/Github/RemoteClaudeCode && npx drizzle-kit studio`

Expected: Drizzle Studio opens showing updated schema with new columns.

---
