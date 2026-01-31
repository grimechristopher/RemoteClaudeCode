# Remote Claude Code — Design Document

## Overview

A self-hosted web app that provides a chat interface to Claude Code running on a home server. Users send natural language requests (calendar management, note-taking, etc.) and Claude Code executes them against local services (CalDAV, Obsidian vault). Supports scheduled and recurring commands.

## Architecture

Single Nuxt 3 application in a Docker container with Claude Code CLI installed. No separate backend — Nuxt server routes handle API, streaming, database, and scheduling.

```
┌─────────────┐       SSE        ┌───────────────────────────┐
│  Browser UI  │◄───────────────►│  Nuxt 3 Server            │
│  (Vue 3)     │                 │                           │
│  - Chat      │                 │  server/api/claude.post   │
│  - Dashboard │                 │  server/api/sessions/*    │
└─────────────┘                 │  server/api/jobs/*        │
                                │  server/plugins/scheduler │
                                └──────────┬────────────────┘
                                           │ Claude Agent SDK
                                           ▼
                                ┌───────────────────────────┐
                                │  Claude Code CLI           │
                                │  (subprocess via SDK)      │
                                │                           │
                                │  Access to:               │
                                │  - CalDAV server           │
                                │  - Obsidian vault (mount)  │
                                │  - Filesystem              │
                                └───────────────────────────┘

                                ┌───────────────────────────┐
                                │  PostgreSQL (host)         │
                                │  - sessions                │
                                │  - messages                │
                                │  - scheduled_jobs          │
                                └───────────────────────────┘
```

## Tech Stack

- **Framework:** Nuxt 3 (Vue 3, server routes, SSR)
- **Claude integration:** @anthropic-ai/claude-agent-sdk
- **Database:** PostgreSQL (existing host instance) via Drizzle ORM
- **Scheduler:** node-cron
- **Containerization:** Docker / Docker Compose
- **Auth:** Handled externally by existing OAuth reverse proxy

## Project Structure

```
remoteclaudecode/
├── pages/
│   ├── index.vue              # Chat interface
│   └── dashboard.vue          # Scheduled jobs management
├── components/
│   ├── chat/
│   │   ├── ChatInput.vue
│   │   ├── MessageList.vue
│   │   └── ToolExecution.vue
│   └── dashboard/
│       ├── JobList.vue
│       └── JobForm.vue
├── server/
│   ├── api/
│   │   ├── claude.post.ts     # SSE streaming endpoint
│   │   ├── sessions/
│   │   │   ├── index.get.ts   # List sessions
│   │   │   ├── index.post.ts  # Create session
│   │   │   └── [id].get.ts    # Get session with messages
│   │   └── jobs/
│   │       ├── index.get.ts   # List jobs
│   │       ├── index.post.ts  # Create job
│   │       ├── [id].put.ts    # Update job
│   │       └── [id].delete.ts # Delete job
│   ├── utils/
│   │   ├── db.ts              # PostgreSQL connection
│   │   └── scheduler.ts       # Cron job management
│   └── plugins/
│       └── scheduler.ts       # Start scheduler on boot
├── composables/
│   └── useChat.ts             # SSE streaming + chat state
├── drizzle/
│   └── schema.ts              # DB schema
├── docker-compose.yml
├── Dockerfile
└── nuxt.config.ts
```

## Data Model

### sessions

| Column     | Type      | Notes                              |
|------------|-----------|------------------------------------|
| id         | UUID PK   |                                    |
| title      | text      | Auto-generated from first message  |
| created_at | timestamp |                                    |
| updated_at | timestamp |                                    |

### messages

| Column     | Type      | Notes                              |
|------------|-----------|------------------------------------|
| id         | UUID PK   |                                    |
| session_id | UUID FK   | References sessions.id             |
| role       | enum      | 'user' or 'assistant'              |
| content    | text      |                                    |
| tool_calls | jsonb     | Tool name, input, output per step  |
| created_at | timestamp |                                    |

### scheduled_jobs

| Column      | Type      | Notes                             |
|-------------|-----------|-----------------------------------|
| id          | UUID PK   |                                   |
| name        | text      | Human-readable label              |
| prompt      | text      | The prompt sent to Claude Code    |
| cron        | text      | Cron expression                   |
| enabled     | boolean   |                                   |
| last_run    | timestamp | Nullable                          |
| last_status | enum      | 'success' or 'error', nullable    |
| last_output | text      | Nullable                          |
| next_run    | timestamp | Nullable                          |
| created_at  | timestamp |                                   |

## Scheduling

- On server boot, the scheduler plugin loads all enabled jobs and registers them with node-cron.
- When a job fires, it runs the prompt through the Claude Agent SDK identically to a chat message.
- Output and status are persisted to the scheduled_jobs row.
- API mutations (create/edit/delete) also update in-memory cron registrations.
- One-off delayed tasks are cron jobs that disable themselves after a single execution.

## UI Design

### Aesthetic

- Dark theme, near-black background (#0a0a0a), subtle card surfaces (#141414)
- Single muted accent color (cyan or green) for active states
- Off-white text (#e4e4e7), dimmer secondary text (#71717a)
- Minimal borders (#1e1e1e), used sparingly
- Sans-serif for UI chrome (Inter / system font), monospace for code and tool output

### Chat View

- Full-height layout, no persistent sidebar
- User messages right-aligned or lightly tinted, assistant messages left
- Tool execution steps as collapsible one-line accordions (e.g., "Read calendar.ics")
- Input bar pinned to bottom, expands as you type, send on Enter
- Session list in a slide-out drawer

### Dashboard View

- Card/table list of scheduled jobs: name, human-readable schedule, last run status, next run
- Modal or inline form for creating/editing jobs: prompt, schedule, enabled toggle
- Expandable job history showing past outputs

## Deployment

Single Docker container via Docker Compose. Mounts:
- Obsidian vault directory (read/write)
- Claude Code config/credentials
- PostgreSQL accessed via network (host instance)

Auth handled by existing OAuth reverse proxy — the app itself has no auth layer.

## Reference

Inspired by [anthropic-claude-dev-console](https://github.com/andrewcchoi/anthropic-claude-dev-console) — rebuilt in Vue/Nuxt with PostgreSQL persistence and a scheduling system.
