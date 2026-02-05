# Remote Claude Code v2 — Personal AI Command Center

## Vision

A self-hosted web app that acts as a personal AI command center. Chat with Claude Code from any browser — phone, tablet, laptop — and watch it manage your digital life: files, notes, calendar, web research. Claude runs in a sandboxed Docker container with controlled access to your services.

## What Exists Today (v1)

- Chat interface with SSE streaming (Claude Agent SDK)
- Session persistence in PostgreSQL (Drizzle ORM)
- Session resume via Claude session IDs
- Scheduled jobs with node-cron (CRUD, enable/disable, one-off)
- Dashboard page for job management
- Dark theme UI (Inter + JetBrains Mono, cyan accent)
- Docker deployment (Dockerfile + docker-compose)
- Tool execution display (collapsible JSON blobs inside messages)

## What's Changing (v2)

### 1. Single-Column Interleaved Feed

Replace the current "tool calls hidden inside message bubbles" with a first-class interleaved feed where user messages, Claude text, and tool activities are all top-level items in chronological order.

```
┌──────────────────────────────────────────┐
│  ☰ Sessions   RemoteClaudeCode    ⚙️     │
├──────────────────────────────────────────┤
│                                          │
│  ┌─ You ─────────────────────────────┐   │
│  │ Add a meeting tomorrow at 3pm     │   │
│  │ with the dentist                  │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ Claude ──────────────────────────┐   │
│  │ I'll add that to your Nextcloud   │   │
│  │ calendar.                         │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ 📄 Read calendar ───────── ✅ ──┐   │
│  │  GET /remote.php/dav/calendars/   │   │
│  │  ▸ 12 events found               │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ ✏️ Create event ─────────── ✅ ──┐   │
│  │  PUT "Dentist" → Tomorrow 3:00 PM │   │
│  │  ▸ Status: 201 Created            │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ Claude ──────────────────────────┐   │
│  │ Done! I've added "Dentist" to     │   │
│  │ your calendar for tomorrow at 3pm.│   │
│  └───────────────────────────────────┘   │
│                                          │
├──────────────────────────────────────────┤
│  [Type a message...]            Send     │
└──────────────────────────────────────────┘
```

**Feed item types:**
- **User messages** — right-aligned, accent-tinted bubble
- **Claude text** — left-aligned, plain text
- **Tool activities** — inline, muted background, smaller text, icon + summary. Collapsed by default (one-line summary), expandable to full input/output. Status indicator: spinner (running), checkmark (done), red X (error)

**Mobile:** Single column works natively. Touch-friendly expand/collapse on tool items. Responsive font sizing.

### 2. Enriched SSE Stream

Current stream events are minimal (`text`, `tool_call`, `tool_result`, `done`). Enrich with structured metadata so the frontend can render the activity feed properly.

Current:
```json
{"type": "tool_call", "name": "Read", "input": {"file_path": "/notes/todo.md"}}
```

Enriched:
```json
{
  "type": "tool_call",
  "name": "Read",
  "input": {"file_path": "/notes/todo.md"},
  "category": "filesystem",
  "summary": "Reading /notes/todo.md"
}
```

Tool categories: `filesystem`, `calendar`, `web`, `command`, `search`, `other`

Tool results include enough content for the feed to display meaningful summaries without showing raw JSON.

### 3. Sandboxed Docker Container

Single container running both the Nuxt app and Claude Code CLI. Claude can only access what's explicitly mounted.

```
┌─────────────────────────────────────┐
│  Docker Container                   │
│                                     │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ Nuxt App │→ │ Claude Code CLI │  │
│  │ (Web UI) │  │ (Agent SDK)     │  │
│  └──────────┘  └─────────────────┘  │
│                                     │
│  Mounted volumes:                   │
│  - /data/notes    (Obsidian vault)  │
│  - /data/repos    (code projects)   │
│  - ~/.claude      (config + MCP)    │
│                                     │
│  Network access:                    │
│  - Nextcloud (CalDAV/WebDAV)        │
│  - Web (search, fetch)              │
│  - PostgreSQL (database)            │
│                                     │
│  No access to:                      │
│  - Host system                      │
│  - Other containers                 │
│  - Services not explicitly exposed  │
└─────────────────────────────────────┘
```

Claude runs with `bypassPermissions` inside the container. The container boundary IS the security boundary.

### 4. MCP Server Integration

Claude Code natively supports MCP (Model Context Protocol) servers. Configure them via `.claude/settings.json` or environment. This gives Claude tools for:

- **Nextcloud** — CalDAV for calendar, WebDAV for files (needs MCP server or direct API access via Claude's web tools)
- **Filesystem** — already built into Claude Code, scoped by volume mounts
- **Web/Search** — already built into Claude Code

No custom integration code needed — MCP servers expose tools that Claude discovers and uses automatically.

### 5. Session System Prompts

Allow per-session or global system prompts so you can tell Claude "you're my personal assistant, here's what you have access to, here are my preferences." This persists across messages in a session.

## Data Model Changes

### messages table — add `feedItems` column

Instead of storing tool calls as a flat array on the assistant message, store an ordered array of feed items that represents the full interleaved sequence:

```typescript
// New: ordered feed items for the interleaved view
feedItems: jsonb('feed_items').$type<Array<{
  type: 'text' | 'tool_call' | 'tool_result'
  content?: string           // for text items
  tool?: string              // tool name
  input?: Record<string, unknown>
  output?: string
  summary?: string           // one-line summary
  category?: string          // filesystem, calendar, web, etc.
  isError?: boolean
  timestamp: string
}>>()
```

Keep the existing `content` and `toolCalls` columns for backward compatibility. The `feedItems` column is the source of truth for rendering.

### sessions table — add `systemPrompt` column

```typescript
systemPrompt: text('system_prompt')  // nullable, per-session instructions
```

## Implementation Priority

1. **Enriched SSE stream + feed item storage** — backend changes to emit richer events and store them
2. **Single-column feed UI** — new `FeedItem.vue` component, refactor `MessageList.vue` to render interleaved items
3. **Docker sandbox improvements** — proper volume mounts, network isolation, MCP server config
4. **System prompts** — DB column + UI for setting per-session prompts
5. **Mobile responsiveness** — test and polish on small screens
6. **MCP servers** — configure Nextcloud and other integrations

## Tech Stack (unchanged)

- Nuxt 4 (Vue 3, SSR, Nitro server)
- PostgreSQL + Drizzle ORM
- @anthropic-ai/claude-agent-sdk
- node-cron
- Docker

## Auth

No auth layer in the app. Handled by existing OAuth reverse proxy. The app assumes any request that reaches it is authorized.
