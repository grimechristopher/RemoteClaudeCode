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
