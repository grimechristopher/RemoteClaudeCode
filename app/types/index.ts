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
