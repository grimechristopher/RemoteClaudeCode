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
