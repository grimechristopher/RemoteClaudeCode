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
  systemPrompt: text('system_prompt'),
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
